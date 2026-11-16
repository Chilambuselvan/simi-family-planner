// Server-only: Google OAuth + Calendar API. Never import this from client code;
// load it with `await import("@/lib/google-calendar.server")` inside server handlers.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"];
const STATE_TTL_MS = 10 * 60 * 1000;

export const CALLBACK_PATH = "/api/google/callback";

export class GoogleApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

function credentials() {
  const id = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const secret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!id || !secret) {
    throw new Error("Google Calendar isn't set up yet: add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Lovable Secrets.");
  }
  return { id, secret };
}

export function redirectUriFor(requestUrl: string): string {
  return new URL(CALLBACK_PATH, new URL(requestUrl).origin).toString();
}

// ---------- signed OAuth state ----------

export type OAuthState = { u: string; f: string; exp: number; n: string };

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signStateWith(secret: string, data: { u: string; f: string }, now = Date.now()): string {
  const payload: OAuthState = { ...data, exp: now + STATE_TTL_MS, n: b64url(randomBytes(12)) };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyStateWith(secret: string, state: string, now = Date.now()): OAuthState | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (typeof p.u !== "string" || typeof p.f !== "string" || typeof p.exp !== "number" || p.exp < now) return null;
    return p;
  } catch {
    return null;
  }
}

export function buildAuthUrl(requestUrl: string, data: { u: string; f: string }): string {
  const { id, secret } = credentials();
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUriFor(requestUrl),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always return a refresh token, even on reconnect
    include_granted_scopes: "true",
    state: signStateWith(secret, data),
  }).toString();
  return url.toString();
}

// ---------- tokens ----------

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new GoogleApiError(json.error ?? `http_${res.status}`, json.error_description);
  return json as TokenResponse;
}

const expiryFrom = (t: TokenResponse) => new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();

/** Returns a valid access token for a connected account, refreshing it if needed. */
export async function getAccessToken(googleAccountId: string): Promise<string> {
  const { data: row, error } = await supabaseAdmin
    .from("google_account_tokens")
    .select("*")
    .eq("google_account_id", googleAccountId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new GoogleApiError("not_connected", "This Google account needs to be reconnected.");
  if (row.access_token && row.access_token_expires_at && new Date(row.access_token_expires_at).getTime() > Date.now()) {
    return row.access_token;
  }
  const { id, secret } = credentials();
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refresh_token, client_id: id, client_secret: secret });
  await supabaseAdmin
    .from("google_account_tokens")
    .update({
      access_token: t.access_token,
      access_token_expires_at: expiryFrom(t),
      ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("google_account_id", googleAccountId);
  return t.access_token;
}

export async function revokeAccount(googleAccountId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("google_account_tokens")
    .select("refresh_token")
    .eq("google_account_id", googleAccountId)
    .maybeSingle();
  if (!data) return;
  // Best effort: if Google is unreachable the local delete still removes our copy.
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(data.refresh_token)}`, { method: "POST" }).catch(() => undefined);
}

// ---------- Calendar API ----------

async function googleGet<T>(accessToken: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new GoogleApiError(json.error?.status ?? `http_${res.status}`, json.error?.message);
  }
  return (await res.json()) as T;
}

export type GoogleCalendarListEntry = { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean };

export async function listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const out: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${CALENDAR_API}/users/me/calendarList`);
    url.searchParams.set("minAccessRole", "reader");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await googleGet<{ items?: GoogleCalendarListEntry[]; nextPageToken?: string }>(accessToken, url.toString());
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && out.length < 500);
  return out;
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  opts: { timeMin: string; timeMax: string; timeZone?: string | undefined },
) {
  type Page = { items?: import("./google-calendar").GoogleEvent[]; nextPageToken?: string };
  const out: NonNullable<Page["items"]> = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.search = new URLSearchParams({
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      singleEvents: "true", // expand recurring events into instances
      orderBy: "startTime",
      maxResults: "2500",
      ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const page = await googleGet<Page>(accessToken, url.toString());
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && ++pages < 5);
  return out;
}

// ---------- OAuth callback ----------

export async function handleOAuthCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const back = (status: string, extra: Record<string, string> = {}) => {
    const to = new URL("/calendar", url.origin);
    to.searchParams.set("google", status);
    for (const [k, v] of Object.entries(extra)) to.searchParams.set(k, v);
    return new Response(null, { status: 302, headers: { location: to.toString() } });
  };

  if (url.searchParams.get("error")) return back("denied");
  try {
    const { id, secret } = credentials();
    const state = verifyStateWith(secret, url.searchParams.get("state") ?? "");
    const code = url.searchParams.get("code");
    if (!state || !code) return back("error");

    const t = await tokenRequest({
      grant_type: "authorization_code",
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUriFor(request.url),
    });
    if (!t.refresh_token) return back("error");
    const info = await googleGet<{ email?: string }>(t.access_token, USERINFO_URL);
    if (!info.email) return back("error");

    // The user must still belong to the family they started the flow from.
    const { data: profile } = await supabaseAdmin.from("profiles").select("family_id").eq("id", state.u).maybeSingle();
    if (!profile || profile.family_id !== state.f) return back("error");

    const { data: account, error } = await supabaseAdmin
      .from("google_accounts")
      .upsert({ user_id: state.u, family_id: state.f, google_email: info.email }, { onConflict: "user_id,google_email" })
      .select("id")
      .single();
    if (error) throw error;
    // If this user reconnects after switching families, stop sharing into the old family.
    await supabaseAdmin.from("external_calendars").delete().eq("google_account_id", account.id).neq("family_id", state.f);

    const { error: tokErr } = await supabaseAdmin.from("google_account_tokens").upsert({
      google_account_id: account.id,
      refresh_token: t.refresh_token,
      access_token: t.access_token,
      access_token_expires_at: expiryFrom(t),
      updated_at: new Date().toISOString(),
    });
    if (tokErr) throw tokErr;

    return back("connected", { account: account.id });
  } catch (e) {
    console.error("[google oauth callback]", e);
    return back("error");
  }
}
