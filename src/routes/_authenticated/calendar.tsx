import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itemsQuery, membersQuery, tasksQuery } from "@/lib/queries";
import { calendarSources, type CalendarEvent } from "@/lib/calendar-sources";
import { pageHead } from "@/lib/head";
import { toISODate } from "@/lib/household";
import { PageHeader } from "@/components/app/page-header";
import { MemberAvatar } from "@/components/app/member-avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => pageHead("Calendar", "Task due dates, maintenance and warranty dates on one family calendar."),
  component: CalendarPage,
});

const kindStyle: Record<CalendarEvent["kind"], string> = {
  task: "bg-secondary text-secondary-foreground",
  maintenance: "bg-accent text-accent-foreground",
  warranty: "bg-warning-soft text-warning-foreground",
  external: "bg-muted text-muted-foreground",
};

function CalendarPage() {
  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const { data: items } = useSuspenseQuery(itemsQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(toISODate(new Date()));

  const events = useMemo(() => calendarSources.filter((s) => s.available).flatMap((s) => s.getEvents({ tasks, items })), [tasks, items]);
  const byDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const days = view === "month"
    ? eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) })
    : eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 1 }), end: addDays(startOfWeek(cursor, { weekStartsOn: 1 }), 6) });
  const step = (n: number) => setCursor(view === "month" ? addMonths(cursor, n) : addWeeks(cursor, n));
  const selectedEvents = byDate[selected] ?? [];

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Tasks, services and warranty dates."
        actions={<Button variant="outline" className="rounded-full" onClick={() => {}} title="Google / Microsoft 365 sync is coming soon"><CalendarPlus /> Connect external calendar (coming soon)</Button>} />
      <div className="card-surface p-3 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></Button>
            <h2 className="min-w-40 text-center text-xl font-semibold">{view === "month" ? format(cursor, "MMMM yyyy") : `Week of ${format(days[0], "d MMM")}`}</h2>
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
                  {evs.slice(0, view === "month" ? 2 : 6).map((e) => <span key={e.id} className={cn("truncate rounded px-1 py-0.5 text-[11px]", kindStyle[e.kind], e.done && "line-through opacity-60")}>{e.title}</span>)}
                  {evs.length > (view === "month" ? 2 : 6) && <span className="text-[11px] text-muted-foreground">+{evs.length - (view === "month" ? 2 : 6)} more</span>}
                </div>
                <div className="flex justify-center gap-0.5 md:hidden">{evs.slice(0, 3).map((e) => <span key={e.id} className={cn("size-1.5 rounded-full", e.kind === "task" ? "bg-primary" : e.kind === "maintenance" ? "bg-terracotta" : "bg-warning")} />)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-semibold">{format(new Date(selected), "EEEE d MMMM")}</h2>
        {selectedEvents.length === 0 ? <p className="text-muted-foreground">Nothing scheduled.</p> : (
          <ul className="grid gap-2">
            {selectedEvents.map((e) => (
              <li key={e.id}>
                <Link {...(e.href ?? { to: "/tasks" })} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 hover:border-primary/30">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", kindStyle[e.kind])}>{e.kind}</span>
                  <span className={cn("flex-1 font-medium", e.done && "line-through opacity-60")}>{e.title}</span>
                  {e.kind === "task" && <MemberAvatar profile={byId[e.assigneeId ?? ""]} size="sm" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
