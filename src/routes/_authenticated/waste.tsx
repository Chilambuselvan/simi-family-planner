import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { meQuery, wastePickupsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { daysUntil, nextPickupByType, relativeDay, wasteStatus } from "@/lib/household";
import { eventsToPickups, parseBerlinRecyclingText, parseIcs, type PickupDraft, WASTE_LABELS, WASTE_STYLES, WASTE_TYPES, type WasteType } from "@/lib/waste";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { AlertPill } from "@/components/app/alert-pill";
import { WasteIcon } from "@/components/app/waste-icon";
import { NextPickupsList } from "@/components/app/next-pickups";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/waste")({
  head: () => pageHead("Waste disposal", "Bin collection days imported from your waste provider's calendar."),
  component: WastePage,
});

function WastePage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: pickups } = useSuspenseQuery(wastePickupsQuery);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<WasteType | "all">("all");
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null);

  const savePickups = async (drafts: PickupDraft[], total: number, source: "ics_import" | "pdf_import") => {
    const familyId = me.profile.family_id!;
    const existing = new Set(pickups.map((p) => `${p.waste_type}|${p.pickup_date}`));
    const fresh = drafts.filter((d) => !existing.has(`${d.waste_type}|${d.pickup_date}`));
    if (fresh.length) {
      const { error } = await supabase.from("waste_pickups").upsert(
        fresh.map((d) => ({ ...d, family_id: familyId, source })),
        { onConflict: "family_id,waste_type,pickup_date", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    return { imported: fresh.length, skipped: total - fresh.length };
  };
  const onImported = (s: { imported: number; skipped: number }) => { setSummary(s); qc.invalidateQueries({ queryKey: ["waste_pickups"] }); toast.success(`${s.imported} pickups imported`); };

  const importIcs = useMutation({
    mutationFn: async (file: File) => {
      const parsed = parseIcs(await file.text());
      if (parsed.length === 0) throw new Error("No events found in this file. Is it an .ics calendar?");
      return savePickups(eventsToPickups(parsed), parsed.length, "ics_import");
    },
    onSuccess: onImported,
    onError: (e: Error) => toast.error(e.message),
  });

  const importPdf = useMutation({
    mutationFn: async (file: File) => {
      const { extractPdfText } = await import("@/lib/pdf-text");
      const drafts = parseBerlinRecyclingText(await extractPdfText(file));
      if (drafts.length === 0) throw new Error("This PDF doesn't contain pickup dates. In the Berlin Recycling Kundenportal, look up your address and save the results table (Datum / Tonne) as a PDF, then import that.");
      return savePickups(drafts, drafts.length, "pdf_import");
    },
    onSuccess: onImported,
    onError: (e: Error) => toast.error(e.message, { duration: 10000 }),
  });

  const upcoming = pickups.filter((p) => daysUntil(p.pickup_date) >= 0 && (filter === "all" || p.waste_type === filter));
  const byDate: [string, typeof upcoming][] = [];
  for (const p of upcoming) {
    const last = byDate[byDate.length - 1];
    if (last && last[0] === p.pickup_date) last[1].push(p); else byDate.push([p.pickup_date, [p]]);
  }
  const lastDate = pickups.at(-1)?.pickup_date;
  const presentTypes = WASTE_TYPES.filter((t) => pickups.some((p) => p.waste_type === t));

  return (
    <div>
      <PageHeader title="Waste disposal" subtitle="Bin days from your waste provider's calendar."
        actions={<>
          <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importIcs.mutate(f); e.target.value = ""; }} />
          <Button onClick={() => fileRef.current?.click()} disabled={importIcs.isPending}><Upload /> {importIcs.isPending ? "Importing…" : "Import calendar (.ics)"}</Button>
          <input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importPdf.mutate(f); e.target.value = ""; }} />
          <Button variant="outline" onClick={() => pdfRef.current?.click()} disabled={importPdf.isPending}><FileText /> {importPdf.isPending ? "Reading PDF…" : "Import PDF (Berlin Recycling)"}</Button>
        </>} />

      {summary && (
        <div className="mb-6 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          <strong>{summary.imported}</strong> events imported, <strong>{summary.skipped}</strong> skipped as duplicates.
        </div>
      )}

      {pickups.length === 0 ? (
        <EmptyState title="No bin days yet" hint="Download the .ics calendar for your address from your waste provider (e.g. BSR), then import it here. Repeat each year when the new calendar comes out."
          action={<Button onClick={() => fileRef.current?.click()}><Upload /> Import calendar (.ics)</Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["all", ...presentTypes] as const).map((t) => (
                <button key={t} onClick={() => setFilter(t)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium", filter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {t !== "all" && <WasteIcon type={t} className="size-4" />}
                  {t === "all" ? "All" : WASTE_LABELS[t]}
                </button>
              ))}
            </div>
            {byDate.length === 0 ? <EmptyState title="No upcoming pickups" hint="Import next year's calendar when it's available." /> : (
              <ul className="grid gap-3">
                {byDate.slice(0, 60).map(([date, list]) => (
                  <li key={date} className="card-surface flex flex-wrap items-center gap-3 p-4">
                    <div className="w-32 shrink-0">
                      <p className="font-semibold">{relativeDay(date)}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(date), "EEE d MMM yyyy")}</p>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-2">
                      {list.map((p) => (
                        <span key={p.id} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", WASTE_STYLES[p.waste_type as WasteType]?.pill)} title={p.label}>
                          <WasteIcon type={p.waste_type as WasteType} className="size-4" />
                          {WASTE_LABELS[p.waste_type as WasteType] ?? p.label}{p.provider && <span className="opacity-70"> · {p.provider}</span>}
                        </span>
                      ))}
                    </div>
                    {wasteStatus(date) === "soon" && <AlertPill level="soon">Put bins out</AlertPill>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="grid content-start gap-4">
            <div className="card-surface p-4">
              <h2 className="text-lg font-semibold">Next by type</h2>
              <div className="mt-3"><NextPickupsList pickups={nextPickupByType(pickups)} /></div>
            </div>
            {lastDate && <p className="px-1 text-sm text-muted-foreground">Calendar runs until {format(parseISO(lastDate), "d MMM yyyy")}. Import the new file from your provider when it's published.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
