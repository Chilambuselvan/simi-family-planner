import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { endOfMonth, format } from "date-fns";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { meQuery, membersQuery, tasksQuery, type Task } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { toISODate } from "@/lib/household";
import { TaskRow } from "@/components/app/task-row";
import { TaskFormDialog } from "@/components/app/task-form-dialog";
import { NativeSelect } from "@/components/app/native-select";
import { MemberAvatar } from "@/components/app/member-avatar";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

type TaskSearch = { assignee?: string; status?: string; category?: string; from?: string; to?: string; view?: "list" | "review" };

export const Route = createFileRoute("/_authenticated/tasks")({
  validateSearch: (s: Record<string, unknown>): TaskSearch => {
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    return { assignee: str(s.assignee), status: str(s.status), category: str(s.category), from: str(s.from), to: str(s.to), view: s.view === "review" ? "review" : undefined };
  },
  head: () => pageHead("Tasks", "All family tasks with filters by person, status, category and date."),
  component: TasksPage,
});

function TasksPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tasks" });
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const setSearch = (patch: Partial<TaskSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const edit = (t: Task) => { setEditing(t); setOpen(true); };
  const categories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))) as string[];

  const assigneeId = search.assignee === "me" ? me.profile.id : search.assignee;
  const status = search.status ?? "open";
  const filtered = tasks.filter((t) => {
    if (assigneeId === "none" ? t.assignee_id : assigneeId && t.assignee_id !== assigneeId) return false;
    if (status === "open" ? t.status === "done" : status !== "all" && t.status !== status) return false;
    if (search.category && t.category !== search.category) return false;
    if (search.from && (!t.due_date || t.due_date < search.from)) return false;
    if (search.to && (!t.due_date || t.due_date > search.to)) return false;
    return true;
  });
  const hasFilters = !!(search.assignee || search.status || search.category || search.from || search.to);
  const isReview = search.view === "review";

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Everything the family needs to get done." actions={<Button className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add task</Button>} />

      <div className="mb-5 inline-flex rounded-full bg-muted p-1 text-sm">
        {([["List", undefined], ["Review mode", "review"]] as const).map(([l, v]) => (
          <button key={l} onClick={() => setSearch({ view: v })} className={cn("rounded-full px-4 py-1.5 font-medium", search.view === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>

      {isReview ? <ReviewMode tasks={tasks} members={members} onEdit={edit} /> : (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <PersonChip active={!search.assignee} onClick={() => setSearch({ assignee: undefined })}>Everyone</PersonChip>
            <PersonChip active={search.assignee === "me"} onClick={() => setSearch({ assignee: "me" })}>Just mine</PersonChip>
            {members.filter((m) => m.id !== me.profile.id).map((m) => (
              <PersonChip key={m.id} active={search.assignee === m.id} onClick={() => setSearch({ assignee: m.id })}><MemberAvatar profile={m} size="sm" className="ring-0" />{m.display_name}</PersonChip>
            ))}
          </div>
          <div className="card-surface mb-5 grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
            <div className="grid gap-1"><Label htmlFor="f-status" className="text-xs">Status</Label>
              <NativeSelect id="f-status" value={status} onChange={(e) => setSearch({ status: e.target.value === "open" ? undefined : e.target.value })}>
                <option value="open">Not done</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="all">All</option>
              </NativeSelect></div>
            <div className="grid gap-1"><Label htmlFor="f-cat" className="text-xs">Category</Label>
              <NativeSelect id="f-cat" value={search.category ?? ""} onChange={(e) => setSearch({ category: e.target.value || undefined })}>
                <option value="">All</option>{categories.map((c) => <option key={c}>{c}</option>)}
              </NativeSelect></div>
            <div className="grid gap-1"><Label htmlFor="f-from" className="text-xs">Due from</Label><Input id="f-from" type="date" value={search.from ?? ""} onChange={(e) => setSearch({ from: e.target.value || undefined })} /></div>
            <div className="grid gap-1"><Label htmlFor="f-to" className="text-xs">Due until</Label><Input id="f-to" type="date" value={search.to ?? ""} onChange={(e) => setSearch({ to: e.target.value || undefined })} /></div>
          </div>
          <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} task{filtered.length === 1 ? "" : "s"}</span>
            {hasFilters && <button className="inline-flex items-center gap-1 font-medium text-primary" onClick={() => navigate({ search: {} })}><X className="size-4" /> Clear filters</button>}
          </div>
          <div className="grid gap-2">
            {filtered.length ? filtered.map((t) => <TaskRow key={t.id} task={t} assignee={byId[t.assignee_id ?? ""]} onEdit={edit} />)
              : <EmptyState title={tasks.length ? "No tasks match these filters" : "No tasks yet"} hint={tasks.length ? undefined : "Add your first one — e.g. 'Bins out on Tuesday'."} />}
          </div>
        </>
      )}
      <TaskFormDialog open={open} onOpenChange={setOpen} task={editing} />
    </div>
  );
}

function PersonChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40")}>{children}</button>;
}

/** Everything due or overdue up to the end of this month, grouped by person. */
function ReviewMode({ tasks, members, onEdit }: { tasks: Task[]; members: ReturnType<typeof useSuspenseQuery<typeof membersQuery>>["data"]; onEdit: (t: Task) => void }) {
  const end = toISODate(endOfMonth(new Date()));
  const relevant = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date <= end);
  const groups = [...members.map((m) => ({ key: m.id, profile: m, list: relevant.filter((t) => t.assignee_id === m.id) })), { key: "none", profile: null, list: relevant.filter((t) => !t.assignee_id) }].filter((g) => g.list.length);
  return (
    <div>
      <p className="mb-4 text-muted-foreground">Open tasks due or overdue by end of {format(new Date(), "MMMM")}, grouped by person.</p>
      {groups.length === 0 ? <EmptyState title="All caught up for this month 🎉" /> : (
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.key} className="card-surface p-4">
              <div className="mb-3 flex items-center gap-2"><MemberAvatar profile={g.profile} /><h2 className="text-lg font-semibold">{g.profile?.display_name ?? "Unassigned"}</h2><span className="ml-auto text-sm text-muted-foreground">{g.list.length}</span></div>
              <div className="grid gap-2">{g.list.map((t) => <TaskRow key={t.id} task={t} onEdit={onEdit} showAssignee={false} />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
