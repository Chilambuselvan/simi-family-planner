import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/queries";

export const MEMBER_COLORS = {
  sage: "bg-member-sage",
  terracotta: "bg-member-terracotta",
  ocean: "bg-member-ocean",
  mustard: "bg-member-mustard",
  plum: "bg-member-plum",
  slate: "bg-member-slate",
} as const;
export type MemberColor = keyof typeof MEMBER_COLORS;

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function MemberAvatar({ profile, size = "md", className }: { profile?: Pick<Profile, "display_name" | "avatar_color"> | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  const color = MEMBER_COLORS[(profile?.avatar_color as MemberColor) ?? "slate"] ?? MEMBER_COLORS.slate;
  const sz = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-12 text-base" : "size-8 text-xs";
  return (
    <span
      title={profile?.display_name ?? "Unassigned"}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-primary-foreground ring-2 ring-card", profile ? color : "bg-muted text-muted-foreground", sz, className)}
    >
      {profile ? initials(profile.display_name) : "—"}
    </span>
  );
}
