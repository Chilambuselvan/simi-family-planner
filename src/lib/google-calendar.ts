import type { CalendarEvent } from "./calendar-sources";

/**
 * Pure helpers for Google Calendar events, shared by the server (mapping API
 * responses) and the client (colours). No network or secrets in here.
 */

export type GoogleEventDate = { date?: string; dateTime?: string; timeZone?: string };
export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: GoogleEventDate;
  end?: GoogleEventDate;
  htmlLink?: string;
};
export type ExternalCalendarRef = { id: string; name: string; color: string };

/** Longest span a single event is expanded across, so a year-long event can't flood the grid. */
export const MAX_SPAN_DAYS = 62;

export const GOOGLE_COLORS = ["#4285F4", "#0B8043", "#D50000", "#F4511E", "#F6BF26", "#8E24AA", "#039BE5", "#616161"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < MAX_SPAN_DAYS; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/**
 * Turns one Google event into one CalendarEvent per day it covers.
 * - All-day events: Google's `end.date` is exclusive.
 * - Timed events: dates are read in the offset Google returned (the timeZone we
 *   asked for), and an event ending exactly at midnight doesn't spill into the next day.
 */
export function googleEventToCalendarEvents(ev: GoogleEvent, cal: ExternalCalendarRef): CalendarEvent[] {
  if (ev.status === "cancelled" || !ev.start) return [];
  let first: string;
  let last: string;
  let time: string | undefined;

  if (ev.start.date) {
    first = ev.start.date;
    const endExclusive = ev.end?.date && ev.end.date > first ? ev.end.date : addDaysISO(first, 1);
    last = addDaysISO(endExclusive, -1);
  } else if (ev.start.dateTime) {
    first = ev.start.dateTime.slice(0, 10);
    time = ev.start.dateTime.slice(11, 16);
    const endDT = ev.end?.dateTime;
    last = endDT ? endDT.slice(0, 10) : first;
    if (endDT && last > first && endDT.slice(11, 16) === "00:00") last = addDaysISO(last, -1);
    if (last < first) last = first;
  } else {
    return [];
  }
  if (!isISODate(first) || !isISODate(last)) return [];

  const title = ev.summary?.trim() || "(No title)";
  return daysBetweenInclusive(first, last).map((date, i) => ({
    id: `gcal-${cal.id}-${ev.id}-${date}`,
    title,
    date,
    time: i === 0 ? time : undefined,
    kind: "external" as const,
    source: "google",
    calendarName: cal.name,
    color: cal.color,
    externalUrl: ev.htmlLink,
  }));
}
