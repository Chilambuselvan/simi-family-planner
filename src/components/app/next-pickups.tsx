import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import type { WastePickup } from "@/lib/queries";
import { WASTE_LABELS, WASTE_STYLES, type WasteType } from "@/lib/waste";
import { daysUntil, relativeDay, wasteStatus } from "@/lib/household";
import { AlertPill } from "./alert-pill";
import { cn } from "@/lib/utils";

export function binDayText(p: WastePickup) {
  const d = daysUntil(p.pickup_date);
  const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
  return `Bin day ${when}: ${p.label}`;
}

export function NextPickupsList({ pickups }: { pickups: WastePickup[] }) {
  return (
    <ul className="grid gap-2">
      {pickups.map((p) => {
        const t = p.waste_type as WasteType;
        return (
          <li key={p.id}><Link to="/waste" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
            <span className="flex min-w-0 items-center gap-2"><span className={cn("size-2.5 shrink-0 rounded-full", WASTE_STYLES[t]?.dot)} /><span className="truncate text-sm font-medium" title={binDayText(p)}>{WASTE_LABELS[t] ?? p.label}</span></span>
            <AlertPill level={wasteStatus(p.pickup_date)}>{relativeDay(p.pickup_date)}</AlertPill>
          </Link></li>
        );
      })}
    </ul>
  );
}

export function NextPickupsCard({ pickups }: { pickups: WastePickup[] }) {
  return (
    <div className="card-surface p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Trash2 className="size-5 text-waste-general" /> Bin days</h2>
      {pickups.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No pickups yet. <Link to="/waste" className="font-medium text-primary hover:underline">Import your calendar</Link></p> : (
        <div className="mt-3"><NextPickupsList pickups={pickups} /></div>
      )}
    </div>
  );
}
