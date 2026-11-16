import { describe, expect, it } from "vitest";
import { addDaysISO, googleEventToCalendarEvents, isISODate, MAX_SPAN_DAYS } from "./google-calendar";
import { signStateWith, verifyStateWith } from "./google-calendar.server";

const cal = { id: "cal1", name: "Family", color: "#4285F4" };

describe("googleEventToCalendarEvents", () => {
  it("maps a single all-day event (end date is exclusive)", () => {
    const out = googleEventToCalendarEvents({ id: "e1", summary: "Holiday", start: { date: "2026-12-24" }, end: { date: "2026-12-25" } }, cal);
    expect(out.map((e) => e.date)).toEqual(["2026-12-24"]);
    expect(out[0]).toMatchObject({ title: "Holiday", kind: "external", color: "#4285F4", calendarName: "Family", time: undefined });
  });

  it("expands a multi-day all-day event across each day", () => {
    const out = googleEventToCalendarEvents({ id: "e2", summary: "Trip", start: { date: "2026-12-30" }, end: { date: "2027-01-02" } }, cal);
    expect(out.map((e) => e.date)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
    expect(new Set(out.map((e) => e.id)).size).toBe(3);
  });

  it("maps a timed event to its local date and start time", () => {
    const out = googleEventToCalendarEvents(
      { id: "e3", summary: "Dentist", start: { dateTime: "2026-11-20T09:30:00+01:00" }, end: { dateTime: "2026-11-20T10:00:00+01:00" }, htmlLink: "https://g/e3" },
      cal,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: "2026-11-20", time: "09:30", externalUrl: "https://g/e3" });
  });

  it("does not spill a timed event ending at midnight into the next day", () => {
    const out = googleEventToCalendarEvents({ id: "e4", start: { dateTime: "2026-11-20T20:00:00+01:00" }, end: { dateTime: "2026-11-21T00:00:00+01:00" } }, cal);
    expect(out.map((e) => e.date)).toEqual(["2026-11-20"]);
  });

  it("shows the time only on the first day of an overnight event", () => {
    const out = googleEventToCalendarEvents({ id: "e5", start: { dateTime: "2026-11-20T22:00:00+01:00" }, end: { dateTime: "2026-11-21T02:00:00+01:00" } }, cal);
    expect(out.map((e) => [e.date, e.time])).toEqual([["2026-11-20", "22:00"], ["2026-11-21", undefined]]);
  });

  it("skips cancelled events and uses a placeholder title", () => {
    expect(googleEventToCalendarEvents({ id: "e6", status: "cancelled", start: { date: "2026-11-20" } }, cal)).toEqual([]);
    expect(googleEventToCalendarEvents({ id: "e7", start: { date: "2026-11-20" } }, cal)[0]!.title).toBe("(No title)");
  });

  it("caps very long events", () => {
    const out = googleEventToCalendarEvents({ id: "e8", start: { date: "2026-01-01" }, end: { date: "2027-01-01" } }, cal);
    expect(out).toHaveLength(MAX_SPAN_DAYS);
  });
});

describe("date helpers", () => {
  it("adds days across month/year boundaries", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("validates ISO dates", () => {
    expect(isISODate("2026-11-16")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("16.11.2026")).toBe(false);
  });
});

describe("OAuth state", () => {
  const secret = "test-secret";
  it("round-trips a signed state", () => {
    const s = signStateWith(secret, { u: "user-1", f: "fam-1" });
    expect(verifyStateWith(secret, s)).toMatchObject({ u: "user-1", f: "fam-1" });
  });
  it("rejects tampered, wrongly signed or expired states", () => {
    const s = signStateWith(secret, { u: "user-1", f: "fam-1" }, 0);
    const [body, sig] = s.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "attacker", f: "fam-1", exp: Date.now() + 1e6, n: "x" })).toString("base64url");
    expect(verifyStateWith(secret, `${forged}.${sig}`)).toBeNull();
    expect(verifyStateWith("other-secret", signStateWith(secret, { u: "u", f: "f" }))).toBeNull();
    expect(verifyStateWith(secret, `${body}.${sig}`)).toBeNull(); // signed at t=0 → expired
    expect(verifyStateWith(secret, "garbage")).toBeNull();
  });
});
