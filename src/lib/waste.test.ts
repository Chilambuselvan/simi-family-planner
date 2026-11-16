import { describe, expect, it } from "vitest";
import { categorizeWaste, eventsToPickups, extractProvider, parseIcs } from "./waste";
import { nextPickupByType, wasteStatus } from "./household";

const ICS = `BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
UID:1\r
SUMMARY:Abholung Hausmüll\r
DTSTART;VALUE=DATE:20261118\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:2\r
SUMMARY:Abholung Wertstoffe (Abholung durch ALBA)\r
DTSTART;VALUE=DATE:20261120\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:3\r
SUMMARY:Abholung Hausmüll\r
DTSTART;VALUE=DATE:20261118\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:4\r
SUMMARY:Abholung Weihnachts\r
 bäume\r
DTSTART:20270110T060000Z\r
END:VEVENT\r
END:VCALENDAR`;

describe("waste ics import", () => {
  it("parses events with folded lines and date-times", () => {
    const ev = parseIcs(ICS);
    expect(ev).toHaveLength(4);
    expect(ev[3]).toMatchObject({ summary: "Abholung Weihnachtsbäume", date: "2027-01-10" });
  });
  it("categorizes German keywords", () => {
    expect(categorizeWaste("Abholung Restmüll")).toBe("general");
    expect(categorizeWaste("Gelbe Tonne")).toBe("recycling");
    expect(categorizeWaste("Abholung Biogut")).toBe("organic");
    expect(categorizeWaste("Abholung Papier")).toBe("paper");
    expect(categorizeWaste("Sperrmüll")).toBe("bulky");
    expect(categorizeWaste("Abholung Weihnachtsbäume")).toBe("seasonal");
    expect(categorizeWaste("Schadstoffmobil")).toBe("other");
  });
  it("extracts provider", () => {
    expect(extractProvider("Abholung Wertstoffe (Abholung durch ALBA)")).toBe("ALBA");
    expect(extractProvider("Abholung Hausmüll")).toBeNull();
  });
  it("dedupes same type on same date", () => {
    expect(eventsToPickups(parseIcs(ICS))).toHaveLength(3);
  });
});

describe("waste alerts", () => {
  const today = new Date(2026, 10, 16);
  it("flags pickups within 2 days as soon", () => {
    expect(wasteStatus("2026-11-18", today)).toBe("soon");
    expect(wasteStatus("2026-11-19", today)).toBe("ok");
  });
  it("picks the next upcoming pickup per type", () => {
    const next = nextPickupByType([
      { waste_type: "general", pickup_date: "2026-11-10" },
      { waste_type: "general", pickup_date: "2026-11-25" },
      { waste_type: "general", pickup_date: "2026-11-18" },
      { waste_type: "paper", pickup_date: "2026-12-01" },
    ], today);
    expect(next.map((p) => p.pickup_date)).toEqual(["2026-11-18", "2026-12-01"]);
  });
});

import { parseBerlinRecyclingText } from "./waste";
describe("berlin recycling pdf text", () => {
  const TEXT = "Kundenportal\nPetkusser Str. 18 a, 12307 Berlin\nDatum  Tonne\n28.10.2026  Papier\n25.11.2026  Papier\n22.12.2026  Papier\n22.12.2026  Papier\n";
  it("parses date + bin rows", () => {
    expect(parseBerlinRecyclingText(TEXT)).toEqual([
      { waste_type: "paper", label: "Papier", pickup_date: "2026-10-28", provider: "Berlin Recycling" },
      { waste_type: "paper", label: "Papier", pickup_date: "2026-11-25", provider: "Berlin Recycling" },
      { waste_type: "paper", label: "Papier", pickup_date: "2026-12-22", provider: "Berlin Recycling" },
    ]);
  });
  it("finds nothing in the holiday-shift PDF text", () => {
    expect(parseBerlinRecyclingText("Vor- und Nachladetage\nFeiertag 25.12.2026 wird nachgeladen am 28.12.2026")).toEqual([]);
  });
});
