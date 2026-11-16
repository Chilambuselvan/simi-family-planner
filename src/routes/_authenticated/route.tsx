import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Boxes, CalendarDays, ClipboardCheck, Home, ListChecks, LogOut, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/queries";
import { MemberAvatar } from "@/components/app/member-avatar";
import { NotificationBell } from "@/components/app/notification-bell";
import { Onboarding } from "@/components/app/onboarding";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: AppLayout,
  pendingComponent: Loading,
});

const nav = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/waste", label: "Bins", icon: Trash2 },
  { to: "/review", label: "Review", icon: ClipboardCheck },
] as const;

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
}

function AppLayout() {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  if (!me.profile.family_id) return <Onboarding name={me.profile.display_name} />;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2 font-display text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Home className="size-5" /></span>HomeBase
        </Link>
        <nav className="grid gap-1">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent !text-sidebar-foreground" }}>
              <n.icon className="size-5" />{n.label}
            </Link>
          ))}
          <Link to="/family" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent !text-sidebar-foreground" }}>
            <Users className="size-5" />Family & settings
          </Link>
        </nav>
        <div className="mt-auto rounded-xl bg-card p-3 text-sm">
          <p className="font-semibold">{me.family?.name}</p>
          <p className="text-muted-foreground">Family home</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <Link to="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold md:invisible">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Home className="size-4" /></span>HomeBase
          </Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={null}><NotificationBell /></Suspense>
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full p-1" aria-label="Account menu"><MemberAvatar profile={me.profile} /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{me.profile.display_name}<div className="text-xs font-normal text-muted-foreground">{me.email}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/family"><Users /> Family & settings</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}><LogOut /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:px-8 md:pb-12">
          <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}><Outlet /></Suspense>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground" activeProps={{ className: "!text-primary" }}>
            <n.icon className="size-5" />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
