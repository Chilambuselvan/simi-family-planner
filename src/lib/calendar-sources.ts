import type { Item, Task, WastePickup } from "./queries";
import { WASTE_LABELS, type WasteType } from "./waste";
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
  kind: "task" | "maintenance" | "warranty" | "waste" | "external";
  source: string;
  wasteType?: WasteType;
  assigneeId?: string | null;
  done?: boolean;
  href?: { to: "/inventory/$itemId"; params: { itemId: string } } | { to: "/tasks" } | { to: "/waste" };
};

export type CalendarSource = {
  id: string;
  label: string;
  available: boolean;
  getEvents: (ctx: { tasks: Task[]; items: Item[]; waste: WastePickup[] }) => CalendarEvent[];
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

export const wastePickupsSource: CalendarSource = {
  id: "waste",
  label: "Bin collections",
  available: true,
  getEvents: ({ waste }) =>
    waste.map((w) => ({
      id: `waste-${w.id}`,
      title: `Bin: ${WASTE_LABELS[w.waste_type as WasteType] ?? w.label}`,
      date: w.pickup_date,
      kind: "waste",
      source: "waste",
      wasteType: w.waste_type as WasteType,
      href: { to: "/waste" },
    })),
};

/** Placeholder for a future Google / Microsoft 365 feed. Not connected yet. */
export const externalCalendarSource: CalendarSource = {
  id: "external",
  label: "External calendar",
  available: false,
  getEvents: () => [],
};

export const calendarSources = [tasksSource, maintenanceSource, wastePickupsSource, externalCalendarSource];
