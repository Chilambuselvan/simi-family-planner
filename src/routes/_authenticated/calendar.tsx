import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleAccountsQuery, itemsQuery, membersQuery, tasksQuery, wastePickupsQuery } from "@/lib/queries";
import { getExternalEvents } from "@/lib/google-calendar.functions";
import { GoogleCalendarDialog } from "@/components/app/google-calendar-dialog";
import { calendarSources, type CalendarEvent } from "@/lib/calendar-sources";
import { WASTE_STYLES, type WasteType } from "@/lib/waste";
import { WasteIcon } from "@/components/app/waste-icon";
import { pageHead } from "@/lib/head";
import { toISODate } from "@/lib/household";
import { PageHeader } from "@/components/app/page-header";
import { MemberAvatar } from "@/components/app/member-avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => pageHead("Calendar", "Task due dates, bin days, maintenance, warranty dates and Google Calendar events on one family calendar."),
  // Set by the Google OAuth callback (/api/google/callback).
  validateSearch: (s: Record<string, unknown>): { google?: string | undefined; account?: string | undefined } => ({
    google: typeof s["google"] === "string" ? s["google"] : undefined,
    account: typeof s["account"] === "string" ? s["account"] : undefined,
  }),
  component: CalendarPage,
});

const kindStyle: Record<CalendarEvent["kind"], string> = {
  task: "bg-secondary text-secondary-foreground",
  maintenance: "bg-accent text-accent-foreground",
  warranty: "bg-warning-soft text-warning-foreground",
  waste: "bg-waste-paper/15 text-waste-paper",
  external: "bg-muted text-muted-foreground",
};

function CalendarPage() {
  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const { data: items } = useSuspenseQuery(itemsQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const { data: waste } = useSuspenseQuery(wastePickupsQuery);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(toISODate(new Date()));
  const { data: googleAccounts } = useSuspenseQuery(googleAccountsQuery);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusAccount, setFocusAccount] = useState<string | undefined>();

  useEffect(() => {
    if (!search.google) return;
    if (search.google === "connected") {
      toast.success("Google account connected — now choose which calendars to show.");
      setFocusAccount(search.account);
      setDialogOpen(true);
    } else if (search.google === "denied") toast.info("Google access was not granted.");
    else toast.error("Couldn't connect Google Calendar. Please try again.");
    navigate({ to: "/calendar", search: {}, replace: true });
  }, [search.google, search.account, navigate]);

  const days = view === "month"
    ? eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) })
    : eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 1 }), end: addDays(startOfWeek(cursor, { weekStartsOn: 1 }), 6) });
  const from = toISODate(days[0]!);
  const to = toISODate(days[days.length - 1]!);
  const hasGoogleCalendars = googleAccounts.some((a) => a.external_calendars.some((c) => c.enabled));
  const googleCalKey = googleAccounts.flatMap((a) => a.external_calendars.filter((c) => c.enabled).map((c) => `${c.id}:${c.color}`)).join(",");

  const externalQuery = useQuery({
    queryKey: ["external_events", from, to, googleCalKey],
    queryFn: () => getExternalEvents({ data: { from, to, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
    enabled: hasGoogleCalendars,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const external = useMemo(() => (hasGoogleCalendars ? externalQuery.data?.events ?? [] : []), [hasGoogleCalendars, externalQuery.data]);

  const events = useMemo(() => {
    const all = calendarSources.filter((s) => s.available).flatMap((s) => s.getEvents({ tasks, items, waste, external }));
    // All-day items (tasks, bins, …) first in source order, then timed events by start time.
    return all.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  }, [tasks, items, waste, external]);
  const byDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const step = (n: number) => setCursor(view === "month" ? addMonths(cursor, n) : addWeeks(cursor, n));
  const selectedEvents = byDate[selected] ?? [];

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Tasks, bins, services, warranty dates and Google Calendar."
        actions={<Button variant="outline" className="rounded-full" onClick={() => { setFocusAccount(undefined); setDialogOpen(true); }}><CalendarPlus /> {googleAccounts.length ? "Google Calendar" : "Connect Google Calendar"}</Button>} />
      <GoogleCalendarDialog open={dialogOpen} onOpenChange={setDialogOpen} focusAccountId={focusAccount} />
      {hasGoogleCalendars && (externalQuery.isError || !!externalQuery.data?.errors.length) && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{externalQuery.isError ? "Couldn't load Google Calendar events." : externalQuery.data!.errors.map((e) => `${e.email}: ${e.message}`).join(" · ")}</span>
        </p>
      )}
      <div className="card-surface p-3 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></Button>
            <h2 className="min-w-40 text-center text-xl font-semibold">{view === "month" ? format(cursor, "MMMM yyyy") : `Week of ${format(days[0]!, "d MMM")}`}</h2>
            <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next"><ChevronRight /></Button>
            <Button variant="ghost" size="sm" onClick={() => { setCursor(new Date()); setSelected(toISODate(new Date())); }}>Today</Button>
          </div>
          <div className="inline-flex rounded-full bg-muted p-1 text-sm">
            {(["month", "week"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={cn("rounded-full px-4 py-1 font-medium capitalize", view === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{v}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const iso = toISODate(d);
            const evs = byDate[iso] ?? [];
            return (
              <button key={iso} onClick={() => setSelected(iso)}
                className={cn("flex flex-col items-stretch rounded-xl border p-1 text-left transition-colors md:p-1.5", view === "month" ? "min-h-16 md:min-h-24" : "min-h-32 md:min-h-48",
                  selected === iso ? "border-primary bg-secondary/50" : "border-transparent hover:bg-muted", view === "month" && !isSameMonth(d, cursor) && "opacity-40")}>
                <span className={cn("mb-1 flex size-6 items-center justify-center self-center rounded-full text-xs font-semibold md:self-start", isToday(d) && "bg-primary text-primary-foreground")}>{format(d, "d")}</span>
                <div className="hidden flex-col gap-0.5 md:flex">
                  {evs.slice(0, view === "month" ? 2 : 6).map((e) => <span key={e.id} className={cn("flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[11px]", kindStyle[e.kind], e.done && "line-through opacity-60")}>{e.kind === "waste" && e.wasteType && <WasteIcon type={e.wasteType} className="size-3" />}{e.color && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />}<span className="truncate">{e.time && <span className="mr-1 tabular-nums opacity-70">{e.time}</span>}{e.title}</span></span>)}
                  {evs.length > (view === "month" ? 2 : 6) && <span className="text-[11px] text-muted-foreground">+{evs.length - (view === "month" ? 2 : 6)} more</span>}
                </div>
                <div className="flex justify-center gap-0.5 md:hidden">{evs.slice(0, 3).map((e) => <span key={e.id} style={e.color ? { backgroundColor: e.color } : undefined} className={cn("size-1.5 rounded-full", e.kind === "task" ? "bg-primary" : e.kind === "maintenance" ? "bg-terracotta" : e.kind === "waste" ? WASTE_STYLES[e.wasteType as WasteType]?.dot ?? "bg-waste-paper" : e.kind === "external" ? "" : "bg-warning")} />)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-semibold">{format(new Date(selected), "EEEE d MMMM")}</h2>
        {selectedEvents.length === 0 ? <p className="text-muted-foreground">Nothing scheduled.</p> : (
          <ul className="grid gap-2">
            {selectedEvents.map((e) => {
              const rowClass = "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 hover:border-primary/30";
              const body = (
                <>
                  <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", e.kind !== "external" && "capitalize", kindStyle[e.kind])}>
                    {e.kind === "waste" && e.wasteType && <WasteIcon type={e.wasteType} className="size-3" />}
                    {e.color && <span className="size-2 rounded-full" style={{ backgroundColor: e.color }} />}
                    {e.kind === "external" ? e.calendarName ?? "Google" : e.kind}
                  </span>
                  {e.time && <span className="text-sm tabular-nums text-muted-foreground">{e.time}</span>}
                  <span className={cn("flex-1 font-medium", e.done && "line-through opacity-60")}>{e.title}</span>
                  {e.kind === "task" && <MemberAvatar profile={byId[e.assigneeId ?? ""]} size="sm" />}
                  {e.externalUrl && <ExternalLink className="size-4 text-muted-foreground" />}
                </>
              );
              return (
                <li key={e.id}>
                  {e.externalUrl ? <a href={e.externalUrl} target="_blank" rel="noopener noreferrer" className={rowClass}>{body}</a>
                    : e.kind === "external" ? <div className={rowClass}>{body}</div>
                    : <Link {...(e.href ?? { to: "/tasks" })} className={rowClass}>{body}</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
