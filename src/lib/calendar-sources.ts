import type { Item, Task, WastePickup } from "./queries";
import { WASTE_LABELS, type WasteType } from "./waste";
import { nextServiceDate } from "./household";

/**
 * Calendar events come from pluggable sources. Tasks, maintenance and bins are built in;
 * Google Calendar events are fetched on the server (see google-calendar.functions.ts)
 * and passed in as `external`. Another feed (e.g. Microsoft 365) can be added the same way.
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
  /** HH:mm start time for timed external events. */
  time?: string | undefined;
  /** Hex colour for external calendars. */
  color?: string | undefined;
  calendarName?: string | undefined;
  /** Opens outside the app (e.g. the event in Google Calendar). */
  externalUrl?: string | undefined;
  href?: { to: "/inventory/$itemId"; params: { itemId: string } } | { to: "/tasks" } | { to: "/waste" };
};

export type CalendarSource = {
  id: string;
  label: string;
  available: boolean;
  getEvents: (ctx: { tasks: Task[]; items: Item[]; waste: WastePickup[]; external: CalendarEvent[] }) => CalendarEvent[];
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

/** Google Calendar events, already fetched and mapped server-side. */
export const googleCalendarSource: CalendarSource = {
  id: "google",
  label: "Google Calendar",
  available: true,
  getEvents: ({ external }) => external,
};

export const calendarSources = [tasksSource, maintenanceSource, wastePickupsSource, googleCalendarSource];
