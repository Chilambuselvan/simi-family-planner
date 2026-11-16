import { Leaf, Newspaper, Package, Recycle, Sofa, Trash2, TreePine, type LucideIcon } from "lucide-react";

export const WASTE_TYPES = ["general", "recycling", "organic", "paper", "bulky", "seasonal", "other"] as const;
export type WasteType = (typeof WASTE_TYPES)[number];

export const WASTE_LABELS: Record<WasteType, string> = {
  general: "General waste",
  recycling: "Recycling",
  organic: "Organic",
  paper: "Paper",
  bulky: "Bulky waste",
  seasonal: "Seasonal",
  other: "Other",
};

/** Colour classes per waste type (semantic tokens from styles.css). */
export const WASTE_STYLES: Record<WasteType, { pill: string; dot: string; icon: string }> = {
  general: { pill: "bg-waste-general/15 text-waste-general", dot: "bg-waste-general", icon: "text-waste-general" },
  recycling: { pill: "bg-waste-recycling/20 text-warning-foreground", dot: "bg-waste-recycling", icon: "text-warning-foreground" },
  organic: { pill: "bg-waste-organic/15 text-waste-organic", dot: "bg-waste-organic", icon: "text-waste-organic" },
  paper: { pill: "bg-waste-paper/15 text-waste-paper", dot: "bg-waste-paper", icon: "text-waste-paper" },
  bulky: { pill: "bg-accent text-accent-foreground", dot: "bg-terracotta", icon: "text-terracotta" },
  seasonal: { pill: "bg-success-soft text-success", dot: "bg-success", icon: "text-success" },
  other: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", icon: "text-muted-foreground" },
};

/** Distinct glyph per waste type so pickups read at a glance, not only by colour. */
export const WASTE_ICONS: Record<WasteType, LucideIcon> = {
  general: Trash2,
  recycling: Recycle,
  organic: Leaf,
  paper: Newspaper,
  bulky: Sofa,
  seasonal: TreePine,
  other: Package,
};

const RULES: [WasteType, string[]][] = [
  ["general", ["hausmüll", "restmüll"]],
  ["recycling", ["wertstoff", "gelbe", "verpackung"]],
  ["organic", ["biogut", "bioabfall"]],
  ["paper", ["papier"]],
  ["bulky", ["sperrmüll"]],
  ["seasonal", ["weihnachtsbaum", "weihnachtsbäum"]],
];

export function categorizeWaste(text: string): WasteType {
  const t = text.normalize("NFC").toLowerCase();
  for (const [type, words] of RULES) if (words.some((w) => t.includes(w))) return type;
  return "other";
}

/** "Abholung Wertstoffe (Abholung durch ALBA)" -> "ALBA"; "(ALBA)" -> "ALBA". */
export function extractProvider(text: string): string | null {
  const m = text.match(/\(([^)]+)\)/);
  if (!m) return null;
  const p = (m[1] ?? "").replace(/^\s*abholung\s+durch\s+/i, "").trim();
  return p || null;
}

export type IcsEvent = { uid: string | null; summary: string; description: string; date: string };

const unescape = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** Minimal VEVENT parser: UID, SUMMARY, DESCRIPTION, DTSTART (date or date-time). */
export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur?.date && (cur.summary || cur.description))
        events.push({ uid: cur.uid ?? null, summary: cur.summary ?? "", description: cur.description ?? "", date: cur.date });
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const name = (line.slice(0, idx).split(";")[0] ?? "").toUpperCase();
    const value = line.slice(idx + 1);
    if (name === "UID") cur.uid = value.trim();
    else if (name === "SUMMARY") cur.summary = unescape(value);
    else if (name === "DESCRIPTION") cur.description = unescape(value);
    else if (name === "DTSTART") {
      const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})/);
      if (m) cur.date = `${m[1]}-${m[2]}-${m[3]}`;
    }
  }
  return events;
}

export type PickupDraft = { waste_type: WasteType; label: string; pickup_date: string; provider: string | null };

/** Turn ICS events into pickups, deduped on (waste_type, pickup_date). */
export function eventsToPickups(events: IcsEvent[]): PickupDraft[] {
  const seen = new Set<string>();
  const out: PickupDraft[] = [];
  for (const e of events) {
    const both = `${e.summary} ${e.description}`;
    const waste_type = categorizeWaste(both);
    const key = `${waste_type}|${e.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ waste_type, label: e.summary || e.description, pickup_date: e.date, provider: extractProvider(e.summary) ?? extractProvider(e.description) });
  }
  return out;
}

export const BERLIN_RECYCLING = "Berlin Recycling";

/** Parse Berlin Recycling Kundenportal text: "DD.MM.YYYY <Tonne>" rows. Unknown bin words are skipped. */
export function parseBerlinRecyclingText(text: string): PickupDraft[] {
  const re = /(\d{2})\.(\d{2})\.(\d{4})\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\- ]*)/g;
  const seen = new Set<string>();
  const out: PickupDraft[] = [];
  for (const m of text.normalize("NFC").matchAll(re)) {
    const label = (m[4] ?? "").trim().split(/\s{2,}/)[0]!.trim();
    const waste_type = categorizeWaste(label);
    if (waste_type === "other" && !/glas/i.test(label)) continue;
    const pickup_date = `${m[3]}-${m[2]}-${m[1]}`;
    const key = `${waste_type}|${pickup_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ waste_type, label, pickup_date, provider: BERLIN_RECYCLING });
  }
  return out;
}
