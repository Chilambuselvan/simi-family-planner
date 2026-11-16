import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "./native-select";
import { meQuery, membersQuery, TASK_CATEGORIES, type Task } from "@/lib/queries";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; task?: Task | null; defaultDate?: string };

export function TaskFormDialog({ open, onOpenChange, task, defaultDate }: Props) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const empty = {
    title: "", description: "", due_date: defaultDate ?? "", priority: "medium", status: "todo",
    category: "", recurrence: "none", assignee_id: me.profile.id,
  };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(task ? {
      title: task.title, description: task.description ?? "", due_date: task.due_date ?? "", priority: task.priority,
      status: task.status, category: task.category ?? "", recurrence: task.recurrence, assignee_id: task.assignee_id ?? "",
    } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: f.title.trim(), description: f.description || null, due_date: f.due_date || null,
        priority: f.priority, status: f.status, category: f.category || null, recurrence: f.recurrence,
        assignee_id: f.assignee_id || null,
        completed_at: f.status === "done" ? (task?.completed_at ?? new Date().toISOString()) : null,
      };
      if (task) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({ ...payload, family_id: me.profile.family_id!, created_by: me.profile.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success(task ? "Task updated" : "Task added"); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("tasks").delete().eq("id", task!.id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted"); onOpenChange(false); },
  });

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
        <form id="task-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (f.title.trim()) save.mutate(); }}>
          <div className="grid gap-1.5"><Label htmlFor="t-title">What needs doing?</Label><Input id="t-title" value={f.title} onChange={set("title")} placeholder="e.g. Clean gutters" required autoFocus /></div>
          <div className="grid gap-1.5"><Label htmlFor="t-desc">Details</Label><Textarea id="t-desc" value={f.description} onChange={set("description")} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="t-assignee">Who</Label>
              <NativeSelect id="t-assignee" value={f.assignee_id} onChange={set("assignee_id")}>
                <option value="">Anyone</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}{m.id === me.profile.id ? " (me)" : ""}</option>)}
              </NativeSelect></div>
            <div className="grid gap-1.5"><Label htmlFor="t-due">Due date</Label><Input id="t-due" type="date" value={f.due_date} onChange={set("due_date")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="t-pri">Priority</Label>
              <NativeSelect id="t-pri" value={f.priority} onChange={set("priority")}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></NativeSelect></div>
            <div className="grid gap-1.5"><Label htmlFor="t-status">Status</Label>
              <NativeSelect id="t-status" value={f.status} onChange={set("status")}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></NativeSelect></div>
            <div className="grid gap-1.5"><Label htmlFor="t-cat">Category</Label>
              <Input id="t-cat" list="task-cats" value={f.category} onChange={set("category")} placeholder="Household" />
              <datalist id="task-cats">{TASK_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div className="grid gap-1.5"><Label htmlFor="t-rec">Repeats</Label>
              <NativeSelect id="t-rec" value={f.recurrence} onChange={set("recurrence")}><option value="none">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></NativeSelect></div>
          </div>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {task ? <Button variant="ghost" className="text-destructive" onClick={() => del.mutate()}>Delete</Button> : <span />}
          <Button type="submit" form="task-form" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
