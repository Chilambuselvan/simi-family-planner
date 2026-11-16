import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, CalendarDays, Car, Copy, Flame, Sun, Tv } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { meQuery, membersQuery, type Family } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { MemberAvatar, MEMBER_COLORS, type MemberColor } from "@/components/app/member-avatar";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => pageHead("Family & settings", "Family members, invite code, your profile and upcoming connections."),
  component: FamilyPage,
});

const upcoming = [
  { icon: CalendarDays, name: "Google / Microsoft 365 calendar", text: "Show family calendars alongside tasks." },
  { icon: Flame, name: "Viessmann heat pump", text: "Live status and service alerts." },
  { icon: Sun, name: "Enpal solar / PV", text: "Production and system health." },
  { icon: Car, name: "Tesla", text: "Charge level and service reminders." },
  { icon: Tv, name: "TV / smart display", text: "Show the family board on a screen." },
  { icon: Bell, name: "Push notifications", text: "Reminders on your phone." },
];

function FamilyPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: members } = useSuspenseQuery(membersQuery);
  const qc = useQueryClient();
  const [name, setName] = useState(me.profile.display_name);
  const [color, setColor] = useState(me.profile.avatar_color as MemberColor);

  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("profiles").update({ display_name: name.trim(), avatar_color: color }).eq("id", me.profile.id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["members"] }); toast.success("Profile saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const code = me.family?.invite_code ?? "";
  return (
    <div>
      <PageHeader title={me.family?.name ?? "Family"} subtitle="Members, invites and settings." />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="text-lg font-semibold">Members</h2>
          <ul className="mt-3 grid gap-2">
            {members.map((m) => <li key={m.id} className="flex items-center gap-3"><MemberAvatar profile={m} /><span className="font-medium">{m.display_name}</span>{m.id === me.profile.id && <span className="text-xs text-muted-foreground">(you)</span>}</li>)}
          </ul>
          <div className="mt-5 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium">Invite family members</p>
            <p className="mt-1 text-sm text-muted-foreground">They create an account, then enter this code.</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-card px-3 py-2 text-center font-display text-xl font-bold tracking-[0.3em]">{code}</code>
              <Button variant="outline" size="icon" aria-label="Copy invite code" onClick={() => { navigator.clipboard.writeText(code); toast.success("Code copied"); }}><Copy /></Button>
            </div>
          </div>
        </section>
        <section className="card-surface p-5">
          <h2 className="text-lg font-semibold">Your profile</h2>
          <form className="mt-3 grid gap-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
            <div className="grid gap-1.5"><Label htmlFor="p-name">Name</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Avatar colour</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MEMBER_COLORS) as MemberColor[]).map((c) => (
                  <button type="button" key={c} aria-label={c} onClick={() => setColor(c)} className={cn("size-9 rounded-full ring-offset-2 ring-offset-card", MEMBER_COLORS[c], color === c && "ring-2 ring-foreground")} />
                ))}
              </div></div>
            <div className="flex items-center gap-3"><MemberAvatar profile={{ display_name: name || "?", avatar_color: color }} size="lg" /><Button type="submit" disabled={save.isPending}>Save profile</Button></div>
          </form>
        </section>
      </div>
      {me.family && <AddressForm family={me.family} />}
      <section className="mt-6">
        <h2 className="mb-3 text-xl font-semibold">Connections <span className="text-sm font-normal text-muted-foreground">— coming soon</span></h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((u) => (
            <div key={u.name} className="flex gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4">
              <u.icon className="size-6 shrink-0 text-muted-foreground" />
              <div><p className="font-medium">{u.name}</p><p className="text-sm text-muted-foreground">{u.text}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const ADDRESS_FIELDS = [
  ["street", "Street", "sm:col-span-3"],
  ["house_number", "House number", "sm:col-span-1"],
  ["postal_code", "Postal code", "sm:col-span-1"],
  ["city", "City", "sm:col-span-2"],
  ["country", "Country", "sm:col-span-1"],
] as const;
type AddressKey = (typeof ADDRESS_FIELDS)[number][0];

function AddressForm({ family }: { family: Family }) {
  const qc = useQueryClient();
  const [addr, setAddr] = useState<Record<AddressKey, string>>(() => ({
    street: family.street ?? "", house_number: family.house_number ?? "", postal_code: family.postal_code ?? "", city: family.city ?? "", country: family.country ?? "",
  }));
  const save = useMutation({
    mutationFn: async () => {
      const clean = Object.fromEntries(Object.entries(addr).map(([k, v]) => [k, v.trim() || null]));
      const { error } = await supabase.from("families").update(clean).eq("id", family.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); toast.success("Address saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="card-surface mt-6 p-5">
      <h2 className="text-lg font-semibold">House address</h2>
      <p className="text-sm text-muted-foreground">Handy when downloading your waste calendar from your provider.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {ADDRESS_FIELDS.map(([k, label, span]) => (
          <div key={k} className={cn("grid gap-1.5", span)}><Label htmlFor={`a-${k}`}>{label}</Label><Input id={`a-${k}`} value={addr[k]} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} /></div>
        ))}
        <div className="sm:col-span-4"><Button type="submit" disabled={save.isPending}>Save address</Button></div>
      </form>
    </section>
  );
}
