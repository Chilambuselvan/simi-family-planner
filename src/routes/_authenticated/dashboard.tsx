import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CalendarClock, Plus, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { meQuery, membersQuery, type Task } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { useDigest } from "@/lib/use-digest";
import { wasteStatus, daysUntil, nextServiceDate, relativeDay, maintenanceStatus, warrantyStatus } from "@/lib/household";
import { TaskRow } from "@/components/app/task-row";
import { TaskFormDialog } from "@/components/app/task-form-dialog";
import { AlertPill } from "@/components/app/alert-pill";
import { NextPickupsCard, binDayText } from "@/components/app/next-pickups";
import { EmptyState } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Home", "Today's tasks, overdue items and upcoming household alerts."),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const [mine, setMine] = useState(false);
  const { overdue, dueSoon, maintenance, warranties, nextPickups } = useDigest(7, mine ? me.profile.id : null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const today = dueSoon.filter((t) => daysUntil(t.due_date!) === 0);
  const week = dueSoon.filter((t) => daysUntil(t.due_date!) > 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const edit = (t: Task) => { setEditing(t); setOpen(true); };

  return (
    <div>
      <section className="bg-hero relative overflow-hidden rounded-3xl p-6 text-primary-foreground md:p-8">
        <p className="text-sm opacity-80">{format(new Date(), "EEEE, d MMMM")}</p>
        <h1 className="mt-1 text-3xl font-bold md:text-4xl">{greet}, {me.profile.display_name.split(" ")[0]}</h1>
        <div className="mt-5 grid grid-cols-3 gap-2 md:max-w-lg">
          <Stat n={today.length} label="due today" />
          <Stat n={overdue.length} label="overdue" warn={overdue.length > 0} />
          <Stat n={maintenance.filter((i) => maintenanceStatus(i) !== "ok").length + warranties.filter((i) => warrantyStatus(i) !== "ok").length} label="home alerts" />
        </div>
        {nextPickups[0] && wasteStatus(nextPickups[0].pickup_date) === "soon" && (
          <Link to="/waste" className="mt-4 inline-flex rounded-full bg-primary-foreground/15 px-4 py-1.5 text-sm font-medium backdrop-blur">🗑️ {binDayText(nextPickups[0])}</Link>
        )}
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm">
          {[["Everyone", false], ["Just mine", true]].map(([l, v]) => (
            <button key={String(l)} onClick={() => setMine(v as boolean)} className={cn("rounded-full px-4 py-1.5 font-medium", mine === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l as string}</button>
          ))}
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus /> Add task</Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          {overdue.length > 0 && (
            <Section title="Overdue" icon={<AlertTriangle className="size-5 text-destructive" />}>
              {overdue.map((t) => <TaskRow key={t.id} task={t} assignee={byId[t.assignee_id ?? ""]} onEdit={edit} />)}
            </Section>
          )}
          <Section title="Today" icon={<CalendarClock className="size-5 text-primary" />}>
            {today.length ? today.map((t) => <TaskRow key={t.id} task={t} assignee={byId[t.assignee_id ?? ""]} onEdit={edit} />) : <EmptyState title="Nothing due today" hint="Enjoy the breather." />}
          </Section>
          <Section title="Later this week">
            {week.length ? week.map((t) => <TaskRow key={t.id} task={t} assignee={byId[t.assignee_id ?? ""]} onEdit={edit} />) : <EmptyState title="Nothing else this week" />}
          </Section>
          <Link to="/tasks" className="text-sm font-medium text-primary hover:underline">See all tasks →</Link>
        </div>
        <aside className="grid content-start gap-4">
          <NextPickupsCard pickups={nextPickups} />
          <div className="card-surface p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Wrench className="size-5 text-terracotta" /> Maintenance</h2>
            {maintenance.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No services due in the next month.</p> : (
              <ul className="mt-3 grid gap-2">
                {maintenance.slice(0, 5).map((i) => {
                  const n = nextServiceDate(i)!;
                  return <li key={i.id}><Link to="/inventory/$itemId" params={{ itemId: i.id }} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                    <span className="truncate text-sm font-medium">{i.name}</span>
                    <AlertPill level={maintenanceStatus(i)}>{relativeDay(n)}</AlertPill></Link></li>;
                })}
              </ul>
            )}
          </div>
          <div className="card-surface p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldAlert className="size-5 text-warning" /> Warranties</h2>
            {warranties.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No warranties ending soon.</p> : (
              <ul className="mt-3 grid gap-2">
                {warranties.slice(0, 5).map((i) => (
                  <li key={i.id}><Link to="/inventory/$itemId" params={{ itemId: i.id }} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                    <span className="truncate text-sm font-medium">{i.name}</span>
                    <AlertPill level={warrantyStatus(i)}>{daysUntil(i.warranty_expiry!) < 0 ? "Expired" : relativeDay(i.warranty_expiry!)}</AlertPill></Link></li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
      <TaskFormDialog open={open} onOpenChange={setOpen} task={editing} />
    </div>
  );
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-primary-foreground/12 px-3 py-3 backdrop-blur", warn && "bg-terracotta/90")}>
      <div className="font-display text-3xl font-bold">{n}</div>
      <div className="text-xs opacity-90">{label}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">{icon}{title}</h2>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}
