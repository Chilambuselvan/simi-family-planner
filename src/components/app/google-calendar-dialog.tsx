import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { googleAccountsQuery, meQuery, membersQuery, type ExternalCalendar, type GoogleAccount } from "@/lib/queries";
import { disconnectGoogle, listGoogleCalendars, startGoogleConnect } from "@/lib/google-calendar.functions";
import { GOOGLE_COLORS } from "@/lib/google-calendar";
import { MemberAvatar } from "@/components/app/member-avatar";
import { cn } from "@/lib/utils";

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["google_accounts"] });
  qc.invalidateQueries({ queryKey: ["external_events"] });
};

export function GoogleCalendarDialog({ open, onOpenChange, focusAccountId }: { open: boolean; onOpenChange: (o: boolean) => void; focusAccountId?: string | undefined }) {
  const { data: accounts } = useSuspenseQuery(googleAccountsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));

  const connect = useMutation({
    mutationFn: () => startGoogleConnect(),
    onSuccess: ({ url }) => {
      // Google's sign-in page refuses to load inside an iframe (e.g. the Lovable preview), so use a new tab there.
      if (window.top !== window.self) window.open(url, "_blank", "noopener");
      else window.location.assign(url);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Google Calendar</DialogTitle>
          <DialogDescription>Each family member can connect their own Google account and choose which calendars the family sees. Read-only: nothing is changed in Google.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No Google accounts connected yet.</p>}
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} owner={byId[a.user_id]} isMine={a.user_id === me.profile.id} familyId={me.profile.family_id!} defaultExpanded={a.id === focusAccountId} />
          ))}
        </div>

        <Button className="mt-2 rounded-full" onClick={() => connect.mutate()} disabled={connect.isPending}>
          {connect.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Connect a Google account
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function AccountCard({ account, owner, isMine, familyId, defaultExpanded }: {
  account: GoogleAccount; owner: Parameters<typeof MemberAvatar>[0]["profile"]; isMine: boolean; familyId: string; defaultExpanded: boolean;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const chosen = new Map(account.external_calendars.map((c) => [c.google_calendar_id, c]));

  const available = useQuery({
    queryKey: ["google_calendar_list", account.id],
    queryFn: () => listGoogleCalendars({ data: { accountId: account.id } }),
    enabled: isMine && expanded,
    staleTime: 5 * 60 * 1000,
  });

  const toggleChosen = useMutation({
    mutationFn: async (c: { id: string; name: string; color: string }) => {
      const existing = chosen.get(c.id);
      const { error } = existing
        ? await supabase.from("external_calendars").delete().eq("id", existing.id)
        : await supabase.from("external_calendars").insert({ family_id: familyId, google_account_id: account.id, google_calendar_id: c.id, name: c.name, color: c.color });
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectGoogle({ data: { accountId: account.id } }),
    onSuccess: () => { invalidate(qc); toast.success("Google account disconnected"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <MemberAvatar profile={owner} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{account.google_email}</span>
        {isMine && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              Choose calendars {expanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Disconnect" title="Disconnect"
              disabled={disconnect.isPending}
              onClick={() => { if (confirm(`Disconnect ${account.google_email}? Its calendars will disappear from the family calendar.`)) disconnect.mutate(); }}>
              <Unlink />
            </Button>
          </>
        )}
      </div>

      {isMine && expanded && (
        <div className="mt-3 grid gap-1.5 border-t border-border pt-3">
          {available.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading your calendars…</p>}
          {available.isError && <p className="text-sm text-destructive">Couldn't load calendars: {(available.error as Error).message}</p>}
          {available.data?.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={chosen.has(c.id)} disabled={toggleChosen.isPending} onCheckedChange={() => toggleChosen.mutate(c)} />
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="truncate">{c.name}</span>
              {c.primary && <span className="text-xs text-muted-foreground">(primary)</span>}
            </label>
          ))}
        </div>
      )}

      {account.external_calendars.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {account.external_calendars.map((c) => <SharedCalendarRow key={c.id} cal={c} />)}
        </ul>
      )}
      {account.external_calendars.length === 0 && !expanded && (
        <p className="mt-2 text-xs text-muted-foreground">{isMine ? "No calendars shared yet — click “Choose calendars”." : "No calendars shared yet."}</p>
      )}
    </div>
  );
}

/** Any family member can hide/show a shared calendar or change its colour. */
function SharedCalendarRow({ cal }: { cal: ExternalCalendar }) {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: async (patch: Partial<Pick<ExternalCalendar, "enabled" | "color">>) => {
      const { error } = await supabase.from("external_calendars").update(patch).eq("id", cal.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <Switch checked={cal.enabled} onCheckedChange={(enabled) => update.mutate({ enabled })} aria-label={`Show ${cal.name}`} />
      <span className={cn("min-w-0 flex-1 truncate", !cal.enabled && "text-muted-foreground")}>{cal.name}</span>
      <div className="flex gap-1">
        {GOOGLE_COLORS.map((color) => (
          <button key={color} type="button" aria-label={`Colour ${color}`} onClick={() => update.mutate({ color })}
            className={cn("size-4 rounded-full ring-offset-2 ring-offset-card", cal.color.toLowerCase() === color.toLowerCase() && "ring-2 ring-foreground")}
            style={{ backgroundColor: color }} />
        ))}
      </div>
    </li>
  );
}
