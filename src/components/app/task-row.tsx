import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, MoreHorizontal, Repeat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "./member-avatar";
import { AlertPill } from "./alert-pill";
import { isTaskOverdue, nextRecurrenceDate, relativeDay, snoozeDate, type Recurrence } from "@/lib/household";
import type { Profile, Task } from "@/lib/queries";

export function useTaskActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const complete = useMutation({
    mutationFn: async (t: Task) => {
      const finishing = t.status !== "done";
      const { error } = await supabase.from("tasks").update({ status: finishing ? "done" : "todo", completed_at: finishing ? new Date().toISOString() : null }).eq("id", t.id);
      if (error) throw error;
      const next = finishing ? nextRecurrenceDate(t.recurrence as Recurrence, t.due_date) : null;
      if (next) {
        const { error: e2 } = await supabase.from("tasks").insert({
          family_id: t.family_id, title: t.title, description: t.description, priority: t.priority, category: t.category,
          recurrence: t.recurrence, assignee_id: t.assignee_id, created_by: t.created_by, due_date: next,
        });
        if (e2) throw e2;
      }
      return { finishing, next };
    },
    onSuccess: ({ finishing, next }) => { done(); if (finishing) toast.success(next ? `Done! Next one scheduled for ${relativeDay(next)}` : "Nice work — task done"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const snooze = useMutation({
    mutationFn: async ({ t, days }: { t: Task; days: number }) => {
      const d = snoozeDate(t.due_date, days);
      const { error } = await supabase.from("tasks").update({ due_date: d }).eq("id", t.id);
      if (error) throw error;
      return d;
    },
    onSuccess: (d) => { done(); toast(`Snoozed to ${relativeDay(d)}`); },
  });
  return { complete, snooze };
}

const priorityDot = { high: "bg-destructive", medium: "bg-warning", low: "bg-member-sage" } as Record<string, string>;

export function TaskRow({ task, assignee, onEdit, showAssignee = true }: { task: Task; assignee?: Profile; onEdit: (t: Task) => void; showAssignee?: boolean }) {
  const { complete, snooze } = useTaskActions();
  const overdue = isTaskOverdue(task);
  const isDone = task.status === "done";
  return (
    <div className={cn("group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/30", isDone && "opacity-60")}>
      <button
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        onClick={() => complete.mutate(task)}
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors", isDone ? "border-success bg-success text-primary-foreground" : "border-input hover:border-success hover:bg-success-soft")}
      >
        {isDone && <Check className="size-4" />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(task)}>
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", priorityDot[task.priority])} title={`${task.priority} priority`} />
          <span className={cn("truncate font-medium", isDone && "line-through")}>{task.title}</span>
          {task.recurrence !== "none" && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label={`Repeats ${task.recurrence}`} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {task.due_date && <AlertPill level={isDone ? "done" : overdue ? "overdue" : "info"}>{relativeDay(task.due_date)}</AlertPill>}
          {task.status === "in_progress" && <AlertPill level="soon">In progress</AlertPill>}
          {task.category && <span>{task.category}</span>}
        </div>
      </button>
      {showAssignee && <MemberAvatar profile={assignee} size="sm" />}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Task options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => snooze.mutate({ t: task, days: 1 })}><Clock /> Snooze 1 day</DropdownMenuItem>
          <DropdownMenuItem onClick={() => snooze.mutate({ t: task, days: 7 })}><Clock /> Snooze 1 week</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(task)}>Reschedule / edit…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
