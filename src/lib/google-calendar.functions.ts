import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CalendarEvent } from "./calendar-sources";
import { GOOGLE_COLORS, addDaysISO, googleEventToCalendarEvents, isHexColor, isISODate } from "./google-calendar";

// This file ships to the client as RPC stubs, so server-only code is loaded lazily inside handlers.
const server = () => import("./google-calendar.server");

const MAX_RANGE_DAYS = 100;

/** Returns the Google consent URL for the signed-in user. */
export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("family_id").eq("id", context.userId).single();
    if (!profile?.family_id) throw new Error("Join or create a family first.");
    const { buildAuthUrl } = await server();
    return { url: buildAuthUrl(getRequest().url, { u: context.userId, f: profile.family_id }) };
  });

async function requireOwnAccount(context: { supabase: SupabaseClient<Database>; userId: string }, accountId: string) {
  // RLS already limits this to the caller's family; ownership is checked on top.
  const { data } = await context.supabase.from("google_accounts").select("id, user_id").eq("id", accountId).maybeSingle();
  if (!data || data.user_id !== context.userId) throw new Error("You can only manage your own Google account.");
}

/** Lists the calendars in one of the caller's own Google accounts, for the picker. */
export const listGoogleCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ accountId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await requireOwnAccount(context, data.accountId);
    const g = await server();
    const token = await g.getAccessToken(data.accountId);
    const cals = await g.listCalendars(token);
    return cals.map((c, i) => ({
      id: c.id,
      name: c.summaryOverride || c.summary || c.id,
      color: c.backgroundColor && isHexColor(c.backgroundColor) ? c.backgroundColor : GOOGLE_COLORS[i % GOOGLE_COLORS.length]!,
      primary: !!c.primary,
    }));
  });

/** Fetches events from every enabled family calendar for the visible date range. */
export const getExternalEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({ from: z.string().refine(isISODate), to: z.string().refine(isISODate), timeZone: z.string().max(64).optional() })
      .refine((v) => v.from <= v.to && v.to <= addDaysISO(v.from, MAX_RANGE_DAYS), "Invalid range"),
  )
  .handler(async ({ context, data }) => {
    const { data: cals, error } = await context.supabase
      .from("external_calendars")
      .select("id, name, color, google_calendar_id, google_account_id, google_accounts(google_email)")
      .eq("enabled", true);
    if (error) throw error;
    if (!cals?.length) return { events: [] as CalendarEvent[], errors: [] as { email: string; message: string }[] };

    const g = await server();
    let timeZone = data.timeZone;
    try {
      if (timeZone) new Intl.DateTimeFormat("en", { timeZone });
    } catch {
      timeZone = undefined;
    }
    // Pad by a day each side so time-zone offsets can't drop edge events.
    const timeMin = `${addDaysISO(data.from, -1)}T00:00:00Z`;
    const timeMax = `${addDaysISO(data.to, 2)}T00:00:00Z`;

    const byAccount = new Map<string, typeof cals>();
    for (const c of cals) byAccount.set(c.google_account_id, [...(byAccount.get(c.google_account_id) ?? []), c]);

    const events: CalendarEvent[] = [];
    const errors: { email: string; message: string }[] = [];
    await Promise.all(
      [...byAccount.entries()].map(async ([accountId, accountCals]) => {
        const email = accountCals[0]?.google_accounts?.google_email ?? "Google account";
        try {
          const token = await g.getAccessToken(accountId);
          await Promise.all(
            accountCals.map(async (c) => {
              try {
                const items = await g.listEvents(token, c.google_calendar_id, { timeMin, timeMax, timeZone });
                for (const ev of items) events.push(...googleEventToCalendarEvents(ev, { id: c.id, name: c.name, color: c.color }));
              } catch (e) {
                errors.push({ email, message: `${c.name}: ${(e as Error).message}` });
              }
            }),
          );
        } catch (e) {
          const code = (e as { code?: string }).code;
          errors.push({ email, message: code === "invalid_grant" || code === "not_connected" ? "Access expired, please reconnect." : (e as Error).message });
        }
      }),
    );
    return { events: events.filter((e) => e.date >= data.from && e.date <= data.to), errors };
  });

/** Disconnects one of the caller's Google accounts: revokes access and removes its calendars. */
export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ accountId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await requireOwnAccount(context, data.accountId);
    const g = await server();
    await g.revokeAccount(data.accountId);
    // Owner-delete is allowed by RLS; tokens and calendars cascade.
    const { error } = await context.supabase.from("google_accounts").delete().eq("id", data.accountId);
    if (error) throw error;
    return { ok: true };
  });
