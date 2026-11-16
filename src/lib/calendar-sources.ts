import type { Item, Task } from "./queries";
import { nextServiceDate } from "./household";

/**
 * Calendar events come from pluggable sources. Tasks and maintenance are built in;
 * an external feed (Google / Microsoft 365) can later be added as another source
 * that returns the same CalendarEvent shape.
 */
export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  kind: "task" | "maintenance" | "warranty" | "external";
  source: string;
  assigneeId?: string | null;
  done?: boolean;
  href?: { to: "/inventory/$itemId"; params: { itemId: string } } | { to: "/tasks" };
};

export type CalendarSource = {
  id: string;
  label: string;
  available: boolean;
  getEvents: (ctx: { tasks: Task[]; items: Item[] }) => CalendarEvent[];
};

export const tasksSource: CalendarSource = {
  id: "tasks",
  label: "Tasks",
  available: true,
  getEvents: ({ tasks }) =>
    tasks
      .filter((t) => t.due_date)
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        date: t.due_date!,
        kind: "task",
        source: "tasks",
        assigneeId: t.assignee_id,
        done: t.status === "done",
        href: { to: "/tasks" },
      })),
};

export const maintenanceSource: CalendarSource = {
  id: "maintenance",
  label: "Maintenance & warranties",
  available: true,
  getEvents: ({ items }) =>
    items.flatMap((i) => {
      const out: CalendarEvent[] = [];
      const next = nextServiceDate(i);
      const href = { to: "/inventory/$itemId" as const, params: { itemId: i.id } };
      if (next) out.push({ id: `maint-${i.id}`, title: `Service: ${i.name}`, date: next, kind: "maintenance", source: "maintenance", href });
      if (i.warranty_expiry)
        out.push({ id: `warr-${i.id}`, title: `Warranty ends: ${i.name}`, date: i.warranty_expiry, kind: "warranty", source: "maintenance", href });
      return out;
    }),
};

/** Placeholder for a future Google / Microsoft 365 feed. Not connected yet. */
export const externalCalendarSource: CalendarSource = {
  id: "external",
  label: "External calendar",
  available: false,
  getEvents: () => [],
};

export const calendarSources = [tasksSource, maintenanceSource, externalCalendarSource];
