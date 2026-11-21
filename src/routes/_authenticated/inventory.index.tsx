import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { MapPin, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoriesQuery, itemsQuery, meQuery } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { maintenanceStatus, warrantyStatus } from "@/lib/household";
import { parseInventoryCsv } from "@/lib/inventory-import";
import { ItemFormDialog } from "@/components/app/item-form-dialog";
import { ItemPhoto } from "@/components/app/item-photo";
import { AlertPill } from "@/components/app/alert-pill";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inventory/")({
  head: () => pageHead("Inventory", "Household items and systems with warranties and maintenance schedules."),
  component: InventoryPage,
});

function InventoryPage() {
  const { data: items } = useSuspenseQuery(itemsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [attention, setAttention] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const usedCats = categories.filter((c) => items.some((i) => i.category === c.name));
  const list = items.filter((i) =>
    (!cat || i.category === cat) &&
    (!q || `${i.name} ${i.location ?? ""}`.toLowerCase().includes(q.toLowerCase())) &&
    (!attention || maintenanceStatus(i) !== "ok" || warrantyStatus(i) !== "ok"));

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const { drafts, errors } = parseInventoryCsv(await file.text());
      if (drafts.length === 0) throw new Error(errors[0] ?? "No rows found in this file.");
      // Skip names already in the inventory so re-importing the same file is harmless.
      const existing = new Set(items.map((i) => i.name.trim().toLowerCase()));
      const fresh = drafts.filter((d) => !existing.has(d.name.toLowerCase()));
      if (fresh.length) {
        const { error } = await supabase.from("items").insert(fresh.map((d) => ({ ...d, family_id: me.profile.family_id!, created_by: me.profile.id })));
        if (error) throw error;
      }
      return { imported: fresh.length, skipped: drafts.length - fresh.length, rowErrors: errors };
    },
    onSuccess: ({ imported, skipped, rowErrors }) => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(`${imported} item${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} already in your inventory` : ""}`);
      rowErrors.forEach((e) => toast.warning(e));
    },
    onError: (e: Error) => toast.error(e.message, { duration: 10000 }),
  });

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Your home's appliances, systems and vehicles." actions={
        <div className="flex gap-2">
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv.mutate(f); e.target.value = ""; }} />
          <Button variant="outline" className="rounded-full" onClick={() => csvRef.current?.click()} disabled={importCsv.isPending}>
            <Upload /> {importCsv.isPending ? "Importing…" : "Import CSV"}
          </Button>
          <Button className="rounded-full" onClick={() => setOpen(true)}><Plus /> Add item</Button>
        </div>
      } />
      <div className="relative mb-3"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search items" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or location" className="h-11 rounded-xl pl-9" /></div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!cat && !attention} onClick={() => { setCat(null); setAttention(false); }}>All</Chip>
        <Chip active={attention} onClick={() => setAttention(!attention)}>Needs attention</Chip>
        {usedCats.map((c) => <Chip key={c.id} active={cat === c.name} onClick={() => setCat(cat === c.name ? null : c.name)}>{c.name}</Chip>)}
      </div>
      {list.length === 0 ? (
        <EmptyState title={items.length ? "No items match" : "No items yet"} hint={items.length ? undefined : "Start with the big ones: solar system, heat pump, EV charger. Or import a CSV from Excel/Notes."} action={!items.length && <Button onClick={() => setOpen(true)}><Plus /> Add first item</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((i) => {
            const m = maintenanceStatus(i), w = warrantyStatus(i);
            return (
              <Link key={i.id} to="/inventory/$itemId" params={{ itemId: i.id }} className="card-surface group overflow-hidden transition-transform hover:-translate-y-0.5">
                <ItemPhoto path={i.photo_path} alt={i.name} className="aspect-[16/9]" />
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{i.category}</p>
                  <h3 className="mt-0.5 text-lg font-semibold">{i.name}</h3>
                  {i.location && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{i.location}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m !== "ok" && <AlertPill level={m}>{m === "overdue" ? "Service overdue" : "Service due soon"}</AlertPill>}
                    {w !== "ok" && <AlertPill level={w}>{w === "overdue" ? "Warranty expired" : "Warranty ending"}</AlertPill>}
                    {m === "ok" && w === "ok" && <AlertPill level="ok">All good</AlertPill>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <ItemFormDialog open={open} onOpenChange={setOpen} onSaved={(id) => navigate({ to: "/inventory/$itemId", params: { itemId: id } })} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40")}>{children}</button>;
}
