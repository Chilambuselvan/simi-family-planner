import { useSuspenseQuery } from "@tanstack/react-query";
import { itemsQuery, tasksQuery } from "./queries";
import { isTaskDueWithin, isTaskOverdue, maintenanceStatus, nextServiceDate, warrantyStatus, daysUntil, MAINTENANCE_SOON_DAYS, WARRANTY_SOON_DAYS } from "./household";

/** Shared digest used by the dashboard, review screen and notification bell. */
export function useDigest(horizonDays = 7, assigneeId?: string | null) {
  const { data: allTasks } = useSuspenseQuery(tasksQuery);
  const { data: items } = useSuspenseQuery(itemsQuery);
  const tasks = assigneeId ? allTasks.filter((t) => t.assignee_id === assigneeId) : allTasks;
  const overdue = tasks.filter((t) => isTaskOverdue(t));
  const dueSoon = tasks.filter((t) => isTaskDueWithin(t, horizonDays));
  const maintHorizon = Math.max(horizonDays, MAINTENANCE_SOON_DAYS);
  const maintenance = items
    .filter((i) => { const n = nextServiceDate(i); return n && daysUntil(n) <= maintHorizon; })
    .sort((a, b) => (nextServiceDate(a)! < nextServiceDate(b)! ? -1 : 1));
  const warrHorizon = Math.max(horizonDays, WARRANTY_SOON_DAYS);
  const warranties = items
    .filter((i) => i.warranty_expiry && daysUntil(i.warranty_expiry) <= warrHorizon && daysUntil(i.warranty_expiry) >= -30)
    .sort((a, b) => (a.warranty_expiry! < b.warranty_expiry! ? -1 : 1));
  const alertCount =
    overdue.length + items.filter((i) => maintenanceStatus(i) !== "ok").length + items.filter((i) => warrantyStatus(i) === "soon").length;
  return { tasks, allTasks, items, overdue, dueSoon, maintenance, warranties, alertCount };
}
