import { WASTE_ICONS, type WasteType } from "@/lib/waste";
import { cn } from "@/lib/utils";

/** Small glyph that identifies a waste type at a glance; colour stays a secondary cue. */
export function WasteIcon({ type, className }: { type: WasteType; className?: string }) {
  const Icon = WASTE_ICONS[type];
  return <Icon className={cn("size-3.5 shrink-0", className)} aria-hidden />;
}
