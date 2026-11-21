// Parses a CSV export (e.g. from Notes, Excel/Numbers, Google Sheets) into household items.
// Column names are matched case-insensitively and flexibly so an export from any of those
// tools is usable without reformatting first. Only "name" is required.

export type ItemDraft = {
  name: string;
  category: string;
  purchase_date: string | null;
  warranty_expiry: string | null;
  location: string | null;
  maintenance_interval_months: number | null;
  last_serviced: string | null;
  notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};

export type ImportResult = { drafts: ItemDraft[]; errors: string[] };

/** Minimal RFC4180 CSV parser: quoted fields, embedded commas/newlines, "" as an escaped quote. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  const body = text.replace(/^﻿/, ""); // strip BOM from Excel exports
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inQuotes) {
      if (c === '"') {
        if (body[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") pushField();
    else if (c === "\n") pushRow();
    else if (c === "\r") continue;
    else field += c;
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const HEADER_ALIASES: Record<string, keyof ItemDraft> = {
  name: "name", item: "name", title: "name",
  category: "category", type: "category",
  purchase_date: "purchase_date", purchased: "purchase_date", "purchase date": "purchase_date", bought: "purchase_date",
  warranty_expiry: "warranty_expiry", warranty: "warranty_expiry", "warranty until": "warranty_expiry", "warranty expiry": "warranty_expiry",
  location: "location", where: "location",
  maintenance_interval_months: "maintenance_interval_months", "service every (months)": "maintenance_interval_months", "service interval": "maintenance_interval_months",
  last_serviced: "last_serviced", "last serviced": "last_serviced", serviced: "last_serviced",
  notes: "notes", note: "notes", description: "notes",
  contact_name: "contact_name", "service contact": "contact_name", contact: "contact_name", installer: "contact_name",
  contact_phone: "contact_phone", phone: "contact_phone",
  contact_email: "contact_email", email: "contact_email",
};

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // German/European day-first format, as commonly exported from Excel in this household's locale.
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Parses an inventory CSV export into item drafts ready to insert, plus any row-level problems found. */
export function parseInventoryCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) return { drafts: [], errors: ["The file is empty."] };

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const colFor: Partial<Record<keyof ItemDraft, number>> = {};
  header.forEach((h, idx) => {
    const key = HEADER_ALIASES[h];
    if (key && colFor[key] === undefined) colFor[key] = idx;
  });
  if (colFor.name === undefined) {
    return { drafts: [], errors: ['No "name" column found. Add a column titled Name (or Item/Title) with each item\'s name.'] };
  }

  const drafts: ItemDraft[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]!;
    const get = (key: keyof ItemDraft) => (colFor[key] !== undefined ? (cells[colFor[key]!] ?? "").trim() : "");
    const name = get("name");
    if (!name) { errors.push(`Row ${i + 1}: skipped, no name.`); continue; }

    const months = get("maintenance_interval_months");
    const monthsNum = months ? Number(months.replace(/[^\d.]/g, "")) : NaN;

    drafts.push({
      name,
      category: get("category") || "Other",
      purchase_date: normalizeDate(get("purchase_date")),
      warranty_expiry: normalizeDate(get("warranty_expiry")),
      location: get("location") || null,
      maintenance_interval_months: Number.isFinite(monthsNum) && monthsNum > 0 ? Math.round(monthsNum) : null,
      last_serviced: normalizeDate(get("last_serviced")),
      notes: get("notes") || null,
      contact_name: get("contact_name") || null,
      contact_phone: get("contact_phone") || null,
      contact_email: get("contact_email") || null,
    });
  }
  return { drafts, errors };
}
