import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDigest } from "@/lib/use-digest";
import { maintenanceStatus, warrantyStatus } from "@/lib/household";

/** In-app reminder indicator. Push notifications can hook into the same digest later. */
export function NotificationBell() {
  const { overdue, items, alertCount } = useDigest(7);
  const maint = items.filter((i) => maintenanceStatus(i) !== "ok").length;
  const warr = items.filter((i) => warrantyStatus(i) === "soon").length;
  const rows = [
    { n: overdue.length, label: "overdue task", to: "/tasks" as const },
    { n: maint, label: "item needs servicing", plural: "items need servicing", to: "/inventory" as const },
    { n: warr, label: "warranty expiring soon", plural: "warranties expiring soon", to: "/inventory" as const },
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
              </Link></li>
            ))}
          </ul>
        )}
        <Link to="/review" className="mt-3 block text-center text-sm font-medium text-primary hover:underline">Open full review</Link>
      </PopoverContent>
    </Popover>
  );
}
