import { describe, expect, it } from "vitest";
import { isTaskOverdue, maintenanceStatus, nextRecurrenceDate, nextServiceDate, snoozeDate, warrantyStatus } from "./household";

const today = new Date(2026, 10, 16); // 16 Nov 2026

describe("recurrence", () => {
  it("daily/weekly/monthly advance from the due date", () => {
    expect(nextRecurrenceDate("daily", "2026-11-16", today)).toBe("2026-11-17");
    expect(nextRecurrenceDate("weekly", "2026-11-16", today)).toBe("2026-11-23");
    expect(nextRecurrenceDate("monthly", "2026-11-16", today)).toBe("2026-12-16");
    expect(nextRecurrenceDate("none", "2026-11-16", today)).toBeNull();
  });
});

describe("snooze", () => {
  it("pushes a future date forward, and an overdue one from today", () => {
    expect(snoozeDate("2026-11-20", 1, today)).toBe("2026-11-21");
    expect(snoozeDate("2026-11-01", 7, today)).toBe("2026-11-23");
  });
});

describe("tasks", () => {
  it("done tasks are never overdue", () => {
    expect(isTaskOverdue({ due_date: "2026-11-01", status: "todo" }, today)).toBe(true);
    expect(isTaskOverdue({ due_date: "2026-11-01", status: "done" }, today)).toBe(false);
  });
});

describe("inventory alerts", () => {
  const base = { purchase_date: null, warranty_expiry: null, maintenance_interval_months: null, last_serviced: null };
  it("next service = last serviced + interval", () => {
    expect(nextServiceDate({ ...base, maintenance_interval_months: 6, last_serviced: "2026-05-01" })).toBe("2026-11-01");
  });
  it("maintenance overdue / soon (within 30 days)", () => {
    expect(maintenanceStatus({ ...base, maintenance_interval_months: 6, last_serviced: "2026-05-01" }, today)).toBe("overdue");
    expect(maintenanceStatus({ ...base, maintenance_interval_months: 6, last_serviced: "2026-06-10" }, today)).toBe("soon");
    expect(maintenanceStatus({ ...base, maintenance_interval_months: 12, last_serviced: "2026-06-10" }, today)).toBe("ok");
  });
  it("warranty expired / expiring within 60 days", () => {
    expect(warrantyStatus({ ...base, warranty_expiry: "2026-11-10" }, today)).toBe("overdue");
    expect(warrantyStatus({ ...base, warranty_expiry: "2027-01-10" }, today)).toBe("soon");
    expect(warrantyStatus({ ...base, warranty_expiry: "2027-03-10" }, today)).toBe("ok");
  });
});
