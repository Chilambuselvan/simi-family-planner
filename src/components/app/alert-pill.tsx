import { cn } from "@/lib/utils";
import type { AlertLevel } from "@/lib/household";

export function AlertPill({ level, children, className }: { level: AlertLevel | "info" | "done"; children: React.ReactNode; className?: string }) {
  const styles = {
    overdue: "bg-danger-soft text-destructive",
    soon: "bg-warning-soft text-warning-foreground",
    ok: "bg-success-soft text-success",
    done: "bg-success-soft text-success",
    info: "bg-muted text-muted-foreground",
  }[level];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", styles, className)}>{children}</span>;
}
