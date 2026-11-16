import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "./native-select";
import { categoriesQuery, meQuery, type Item } from "@/lib/queries";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; item?: Item | null; onSaved?: (id: string) => void };

const blank = {
  name: "", category: "Appliance", purchase_date: "", warranty_expiry: "", location: "", maintenance_interval_months: "",
  last_serviced: "", notes: "", contact_name: "", contact_phone: "", contact_email: "",
};

export function ItemFormDialog({ open, onOpenChange, item, onSaved }: Props) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const [f, setF] = useState(blank);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setF(item ? {
      name: item.name, category: item.category, purchase_date: item.purchase_date ?? "", warranty_expiry: item.warranty_expiry ?? "",
      location: item.location ?? "", maintenance_interval_months: item.maintenance_interval_months?.toString() ?? "",
      last_serviced: item.last_serviced ?? "", notes: item.notes ?? "", contact_name: item.contact_name ?? "",
      contact_phone: item.contact_phone ?? "", contact_email: item.contact_email ?? "",
    } : blank);
  }, [open, item]);

  const save = useMutation({
    mutationFn: async () => {
      const familyId = me.profile.family_id!;
      let photo_path = item?.photo_path ?? null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${familyId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("item-photos").upload(path, file, { contentType: file.type });
        if (error) throw error;
        photo_path = path;
      }
      const payload = {
        name: f.name.trim(), category: f.category, purchase_date: f.purchase_date || null, warranty_expiry: f.warranty_expiry || null,
        location: f.location || null, maintenance_interval_months: f.maintenance_interval_months ? Number(f.maintenance_interval_months) : null,
        last_serviced: f.last_serviced || null, notes: f.notes || null, contact_name: f.contact_name || null,
        contact_phone: f.contact_phone || null, contact_email: f.contact_email || null, photo_path,
      };
      if (item) {
        const { error } = await supabase.from("items").update(payload).eq("id", item.id);
        if (error) throw error;
        return item.id;
      }
      const { data, error } = await supabase.from("items").insert({ ...payload, family_id: familyId, created_by: me.profile.id }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["items"] }); toast.success(item ? "Item updated" : "Item added"); onOpenChange(false); onSaved?.(id); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{item ? "Edit item" : "Add household item"}</DialogTitle></DialogHeader>
        <form id="item-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) save.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid gap-1.5 sm:col-span-1"><Label htmlFor="i-name">Name</Label><Input id="i-name" value={f.name} onChange={set("name")} placeholder="e.g. Heat pump" required /></div>
            <div className="col-span-2 grid gap-1.5 sm:col-span-1"><Label htmlFor="i-cat">Category</Label>
              <NativeSelect id="i-cat" value={f.category} onChange={set("category")}>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</NativeSelect></div>
            <div className="col-span-2 grid gap-1.5"><Label htmlFor="i-loc">Where is it?</Label><Input id="i-loc" value={f.location} onChange={set("location")} placeholder="e.g. Garage, Roof, Kitchen" /></div>
            <div className="grid gap-1.5"><Label htmlFor="i-pd">Purchased</Label><Input id="i-pd" type="date" value={f.purchase_date} onChange={set("purchase_date")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="i-we">Warranty until</Label><Input id="i-we" type="date" value={f.warranty_expiry} onChange={set("warranty_expiry")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="i-mi">Service every</Label>
              <NativeSelect id="i-mi" value={f.maintenance_interval_months} onChange={set("maintenance_interval_months")}>
                <option value="">No schedule</option><option value="1">Month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">Year</option><option value="24">2 years</option><option value="36">3 years</option>
              </NativeSelect></div>
            <div className="grid gap-1.5"><Label htmlFor="i-ls">Last serviced</Label><Input id="i-ls" type="date" value={f.last_serviced} onChange={set("last_serviced")} /></div>
          </div>
          <fieldset className="grid gap-3 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-medium">Service contact</legend>
            <Input aria-label="Company or person" value={f.contact_name} onChange={set("contact_name")} placeholder="Installer / service company" />
            <div className="grid grid-cols-2 gap-3">
              <Input aria-label="Phone" type="tel" value={f.contact_phone} onChange={set("contact_phone")} placeholder="Phone" />
              <Input aria-label="Email" type="email" value={f.contact_email} onChange={set("contact_email")} placeholder="Email" />
            </div>
          </fieldset>
          <div className="grid gap-1.5"><Label htmlFor="i-notes">Notes</Label><Textarea id="i-notes" value={f.notes} onChange={set("notes")} rows={2} placeholder="Model number, serial, tips…" /></div>
          <div className="grid gap-1.5"><Label htmlFor="i-photo">Photo</Label><Input id="i-photo" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        </form>
        <DialogFooter><Button type="submit" form="item-form" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save item"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
