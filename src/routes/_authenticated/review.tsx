import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CalendarClock, ShieldAlert, Wrench } from "lucide-react";
import { meQuery, membersQuery, type Task } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { useDigest } from "@/lib/use-digest";
import { NextPickupsList } from "@/components/app/next-pickups";
import { daysUntil, maintenanceStatus, nextServiceDate, relativeDay, warrantyStatus } from "@/lib/household";
import { TaskRow } from "@/components/app/task-row";
import { TaskFormDialog } from "@/components/app/task-form-dialog";
import { AlertPill } from "@/components/app/alert-pill";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => pageHead("Review", "Weekly or monthly digest of what's due, overdue and needing attention at home."),
  component: ReviewPage,
});

function ReviewPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const [range, setRange] = useState<7 | 30>(7);
  const [mine, setMine] = useState(false);
  const { overdue, dueSoon, maintenance, warranties, nextPickups } = useDigest(range, mine ? me.profile.id : null);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const [editing, setEditing] = useState<Task | null>(null);
  const edit = (t: Task) => setEditing(t);
  const maintInRange = maintenance.filter((i) => daysUntil(nextServiceDate(i)!) <= range);
  const binsInRange = nextPickups.filter((p) => daysUntil(p.pickup_date) <= range);
  const warrInRange = warranties.filter((i) => daysUntil(i.warranty_expiry!) <= Math.max(range, 60));

  return (
    <div>
      <PageHeader title="Review" subtitle="A quick check-in on everything that needs attention." />
      <div className="mb-6 flex flex-wrap gap-2">
        <Toggle options={[["This week", 7], ["This month", 30]]} value={range} onChange={setRange} />
        <Toggle options={[["Everyone", false], ["Just mine", true]]} value={mine} onChange={setMine} />
        <Link to="/tasks" search={{ view: "review" }} className="self-center text-sm font-medium text-primary hover:underline">Month by person →</Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Block icon={<AlertTriangle className="size-5 text-destructive" />} title="Overdue tasks" count={overdue.length} empty="Nothing overdue. 🎉">
          {overdue.map((t) => <TaskRow key={t.id} task={t} assignee={byId[t.assignee_id ?? ""]} onEdit={edit} />)}
        </Block>
        <Block icon={<CalendarClock className="size-5 text-primary" />} title={`Due in the next ${range === 7 ? "7" : "30"} days`} count={dueSoon.length} empty="Nothing coming up.">
          {dueSoon.map((t) => <TaskRow key={t.id} task={t} assignee={byId[t.assignee_id ?? ""]} onEdit={edit} />)}
        </Block>
        <Block icon={<Wrench className="size-5 text-terracotta" />} title="Maintenance" count={maintInRange.length} empty="No services due.">
          {maintInRange.map((i) => (
            <Link key={i.id} to="/inventory/$itemId" params={{ itemId: i.id }} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-3 hover:border-primary/30">
              <span><span className="font-medium">{i.name}</span>{i.contact_name && <span className="block text-xs text-muted-foreground">{i.contact_name}</span>}</span>
              <AlertPill level={maintenanceStatus(i)}>{relativeDay(nextServiceDate(i)!)}</AlertPill>
            </Link>
          ))}
        </Block>
        <Block icon={<ShieldAlert className="size-5 text-warning" />} title="Warranties expiring" count={warrInRange.length} empty="No warranties ending soon.">
          {warrInRange.map((i) => (
            <Link key={i.id} to="/inventory/$itemId" params={{ itemId: i.id }} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-3 hover:border-primary/30">
              <span className="font-medium">{i.name}</span>
              <AlertPill level={warrantyStatus(i)}>{daysUntil(i.warranty_expiry!) < 0 ? "Expired" : relativeDay(i.warranty_expiry!)}</AlertPill>
            </Link>
          ))}
        </Block>
        <Block icon={<Trash2 className="size-5 text-waste-general" />} title="Next bin days" count={binsInRange.length} empty="No pickups in this period.">
          <NextPickupsList pickups={binsInRange} />
        </Block>
      </div>
      <TaskFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} task={editing} />
    </div>
  );
}

function Toggle<T>({ options, value, onChange }: { options: [string, T][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1 text-sm">
      {options.map(([l, v]) => <button key={l} onClick={() => onChange(v)} className={cn("rounded-full px-4 py-1.5 font-medium", value === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</button>)}
    </div>
  );
}

function Block({ icon, title, count, empty, children }: { icon: React.ReactNode; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="card-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">{icon}{title}<span className="ml-auto rounded-full bg-muted px-2 text-sm">{count}</span></h2>
      <div className="grid gap-2">{count ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</div>
    </section>
  );
}
