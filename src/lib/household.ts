import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, parseISO } from "date-fns";

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

/** Days ahead that count as "soon" for each kind of alert. */
export const MAINTENANCE_SOON_DAYS = 30;
export const WARRANTY_SOON_DAYS = 60;

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");
export const parseDate = (s: string) => parseISO(s);

export function daysUntil(date: string, today: Date = new Date()) {
  return differenceInCalendarDays(parseISO(date), today);
}

/** Next due date for a recurring task, based on its current due date (or today). */
export function nextRecurrenceDate(recurrence: Recurrence, from: string | null, today: Date = new Date()): string | null {
  if (recurrence === "none") return null;
  const base = from ? parseISO(from) : today;
  const next = recurrence === "daily" ? addDays(base, 1) : recurrence === "weekly" ? addWeeks(base, 1) : addMonths(base, 1);
  return toISODate(next);
}

export function snoozeDate(from: string | null, days: number, today: Date = new Date()): string {
  const base = from && daysUntil(from, today) >= 0 ? parseISO(from) : today;
  return toISODate(addDays(base, days));
}

export type TaskLike = { due_date: string | null; status: string };
export function isTaskOverdue(t: TaskLike, today: Date = new Date()) {
  return t.status !== "done" && !!t.due_date && daysUntil(t.due_date, today) < 0;
}
export function isTaskDueWithin(t: TaskLike, days: number, today: Date = new Date()) {
  if (t.status === "done" || !t.due_date) return false;
  const d = daysUntil(t.due_date, today);
  return d >= 0 && d <= days;
}

export type ItemLike = {
  purchase_date: string | null;
  warranty_expiry: string | null;
  maintenance_interval_months: number | null;
  last_serviced: string | null;
};

/** When the next service is due: last service (or purchase) + interval. */
export function nextServiceDate(item: ItemLike): string | null {
  if (!item.maintenance_interval_months) return null;
  const base = item.last_serviced ?? item.purchase_date;
  if (!base) return null;
  return toISODate(addMonths(parseISO(base), item.maintenance_interval_months));
}

export type AlertLevel = "ok" | "soon" | "overdue";

export function maintenanceStatus(item: ItemLike, today: Date = new Date()): AlertLevel {
  const next = nextServiceDate(item);
  if (!next) return "ok";
  const d = daysUntil(next, today);
  if (d < 0) return "overdue";
  if (d <= MAINTENANCE_SOON_DAYS) return "soon";
  return "ok";
}

export function warrantyStatus(item: ItemLike, today: Date = new Date()): AlertLevel {
  if (!item.warranty_expiry) return "ok";
  const d = daysUntil(item.warranty_expiry, today);
  if (d < 0) return "overdue";
  if (d <= WARRANTY_SOON_DAYS) return "soon";
  return "ok";
}

export function relativeDay(date: string, today: Date = new Date()) {
  const d = daysUntil(date, today);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${-d} days ago`;
  if (d < 7) return format(parseISO(date), "EEEE");
  return format(parseISO(date), "d MMM yyyy");
}

/** A bin pickup counts as "soon" (put the bin out) within this many days. */
export const WASTE_SOON_DAYS = 2;

export function wasteStatus(pickupDate: string, today: Date = new Date()): AlertLevel {
  const d = daysUntil(pickupDate, today);
  return d >= 0 && d <= WASTE_SOON_DAYS ? "soon" : "ok";
}

/** Next upcoming (today or later) pickup for each waste type, soonest first. */
export function nextPickupByType<T extends { waste_type: string; pickup_date: string }>(pickups: T[], today: Date = new Date()): T[] {
  const best: Record<string, T> = {};
  for (const p of pickups) {
    if (daysUntil(p.pickup_date, today) < 0) continue;
    const cur = best[p.waste_type];
    if (!cur || p.pickup_date < cur.pickup_date) best[p.waste_type] = p;
  }
  return Object.values(best).sort((a, b) => (a.pickup_date < b.pickup_date ? -1 : 1));
}
