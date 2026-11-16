import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDigest } from "@/lib/use-digest";
import { WasteIcon } from "./waste-icon";
import type { WasteType } from "@/lib/waste";
import { maintenanceStatus, warrantyStatus, wasteStatus } from "@/lib/household";

/** In-app reminder indicator. Push notifications can hook into the same digest later. */
export function NotificationBell() {
  const { overdue, items, alertCount, nextPickups } = useDigest(7);
  const maint = items.filter((i) => maintenanceStatus(i) !== "ok").length;
  const warr = items.filter((i) => warrantyStatus(i) === "soon").length;
  const bins = nextPickups.filter((p) => wasteStatus(p.pickup_date) === "soon").length;
  const binTypes = [...new Set(nextPickups.filter((p) => wasteStatus(p.pickup_date) === "soon").map((p) => p.waste_type as WasteType))].slice(0, 3);
  const rows: { n: number; label: string; plural?: string; to: "/tasks" | "/inventory" | "/waste"; icon?: React.ReactNode }[] = [
    { n: overdue.length, label: "overdue task", to: "/tasks" },
    { n: maint, label: "item needs servicing", plural: "items need servicing", to: "/inventory" },
    { n: warr, label: "warranty expiring soon", plural: "warranties expiring soon", to: "/inventory" },
    { n: bins, label: "bin pickup in the next 2 days", plural: "bin pickups in the next 2 days", to: "/waste", icon: binTypes.map((t) => <WasteIcon key={t} type={t} className="size-4" />) },
  ].filter((r) => r.n > 0);
  return (
    <Popover>
      <PopoverTrigger className="relative rounded-full p-2 hover:bg-muted" aria-label={`Reminders (${alertCount})`}>
        <Bell className="size-5" />
        {alertCount > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{alertCount}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 font-semibold">Reminders</p>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">All clear. Nothing needs attention.</p> : (
          <ul className="grid gap-1">
            {rows.map((r) => (
              <li key={r.label}><Link to={r.to} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                <span className="flex size-6 items-center justify-center rounded-full bg-danger-soft text-xs font-bold text-destructive">{r.n}</span>
                {r.n === 1 ? r.label : r.plural ?? `${r.label}s`}
                {r.icon && <span className="ml-auto flex items-center gap-1 text-muted-foreground">{r.icon}</span>}
              </Link></li>
            ))}
          </ul>
        )}
        <Link to="/review" className="mt-3 block text-center text-sm font-medium text-primary hover:underline">Open full review</Link>
      </PopoverContent>
    </Popover>
  );
}
