import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CheckCircle2, Mail, MapPin, Pencil, Phone, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { itemsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { maintenanceStatus, nextServiceDate, relativeDay, toISODate, warrantyStatus } from "@/lib/household";
import { ItemFormDialog } from "@/components/app/item-form-dialog";
import { ItemPhoto } from "@/components/app/item-photo";
import { AlertPill } from "@/components/app/alert-pill";

export const Route = createFileRoute("/_authenticated/inventory/$itemId")({
  head: () => pageHead("Item details", "Warranty, maintenance and service contact for a household item."),
  component: ItemDetail,
  notFoundComponent: () => <p>Item not found.</p>,
  errorComponent: ({ error }) => <p role="alert">{(error as Error).message}</p>,
});

const fmt = (d: string | null) => (d ? format(parseISO(d), "d MMM yyyy") : "—");

function ItemDetail() {
  const { itemId } = Route.useParams();
  const { data: items } = useSuspenseQuery(itemsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const item = items.find((i) => i.id === itemId);

  const serviced = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("items").update({ last_serviced: toISODate(new Date()) }).eq("id", itemId); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); toast.success("Marked as serviced today"); },
  });
  const del = useMutation({
    mutationFn: async () => {
      if (item?.photo_path) await supabase.storage.from("item-photos").remove([item.photo_path]);
      const { error } = await supabase.from("items").delete().eq("id", itemId); if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); navigate({ to: "/inventory" }); toast.success("Item deleted"); },
  });

  if (!item) return <div><Link to="/inventory" className="text-primary">← Back</Link><p className="mt-4">This item doesn't exist anymore.</p></div>;
  const next = nextServiceDate(item);
  const m = maintenanceStatus(item), w = warrantyStatus(item);

  return (
    <div>
      <Link to="/inventory" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Inventory</Link>
      <div className="card-surface overflow-hidden">
        <ItemPhoto path={item.photo_path} alt={item.name} className="aspect-[21/9] max-h-72 w-full" />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.category}</p>
              <h1 className="text-3xl font-bold">{item.name}</h1>
              {item.location && <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" />{item.location}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(true)}><Pencil /> Edit</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Delete item"><Trash2 /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete {item.name}?</AlertDialogTitle><AlertDialogDescription>This removes it for the whole family.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-muted p-4">
              <h2 className="flex items-center gap-2 font-semibold"><Wrench className="size-4" /> Maintenance</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Interval</dt><dd>{item.maintenance_interval_months ? `Every ${item.maintenance_interval_months} months` : "Not set"}</dd>
                <dt className="text-muted-foreground">Last serviced</dt><dd>{fmt(item.last_serviced)}</dd>
                <dt className="text-muted-foreground">Next service</dt><dd>{next ? <AlertPill level={m}>{relativeDay(next)}</AlertPill> : "—"}</dd>
              </dl>
              {item.maintenance_interval_months && <Button size="sm" variant="secondary" className="mt-4" onClick={() => serviced.mutate()}><CheckCircle2 /> Serviced today</Button>}
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <h2 className="font-semibold">Purchase & warranty</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Purchased</dt><dd>{fmt(item.purchase_date)}</dd>
                <dt className="text-muted-foreground">Warranty until</dt><dd className="flex items-center gap-1.5">{fmt(item.warranty_expiry)}{w !== "ok" && <AlertPill level={w}>{w === "overdue" ? "Expired" : "Soon"}</AlertPill>}</dd>
              </dl>
            </div>
          </div>

          {(item.contact_name || item.contact_phone || item.contact_email) && (
            <div className="mt-4 rounded-2xl border border-border p-4">
              <h2 className="font-semibold">Service contact</h2>
              {item.contact_name && <p className="mt-1">{item.contact_name}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.contact_phone && <Button asChild variant="outline" size="sm"><a href={`tel:${item.contact_phone}`}><Phone /> {item.contact_phone}</a></Button>}
                {item.contact_email && <Button asChild variant="outline" size="sm"><a href={`mailto:${item.contact_email}?subject=${encodeURIComponent(`Service request: ${item.name}`)}`}><Mail /> {item.contact_email}</a></Button>}
              </div>
            </div>
          )}
          {item.notes && <div className="mt-4"><h2 className="font-semibold">Notes</h2><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.notes}</p></div>}
          <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Live device data (e.g. heat pump, solar, vehicle) will appear here once connections are available.
          </div>
        </div>
      </div>
      <ItemFormDialog open={open} onOpenChange={setOpen} item={item} />
    </div>
  );
}
