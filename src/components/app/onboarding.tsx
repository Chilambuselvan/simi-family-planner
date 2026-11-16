import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Onboarding({ name }: { name: string }) {
  const qc = useQueryClient();
  const [familyName, setFamilyName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success("Welcome to your HomeBase!");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-3xl font-bold">Hi {name} 👋</h1>
        <p className="mt-2 text-center text-muted-foreground">Start a new family home, or join one with an invite code.</p>
        <div className="mt-8 grid gap-4">
          <form className="card-surface grid gap-3 p-5" onSubmit={(e) => { e.preventDefault(); run(() => supabase.rpc("create_family", { _name: familyName.trim() })); }}>
            <div className="flex items-center gap-2 font-semibold"><Home className="size-5 text-primary" />Start a new family</div>
            <Label htmlFor="fam" className="sr-only">Family name</Label>
            <Input id="fam" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="e.g. The Elangovans" required />
            <Button type="submit" disabled={busy}>Create family</Button>
          </form>
          <form className="card-surface grid gap-3 p-5" onSubmit={(e) => { e.preventDefault(); run(() => supabase.rpc("join_family", { _code: code })); }}>
            <div className="flex items-center gap-2 font-semibold"><Users className="size-5 text-terracotta" />Join with invite code</div>
            <Label htmlFor="code" className="sr-only">Invite code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="8-letter code" className="uppercase tracking-widest" required />
            <Button type="submit" variant="secondary" disabled={busy}>Join family</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
