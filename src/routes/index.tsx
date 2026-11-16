import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Home, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HomeBase — Run your home together" },
      { name: "description", content: "One shared place for family tasks, household items, warranties and maintenance reminders." },
      { property: "og:title", content: "HomeBase — Run your home together" },
      { property: "og:description", content: "One shared place for family tasks, household items, warranties and maintenance reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: CheckCircle2, title: "Shared to-dos", text: "Assign chores to anyone, repeat them, snooze them." },
  { icon: Wrench, title: "Home inventory", text: "Heat pump, solar, EV charger — warranties and service dates in one place." },
  { icon: CalendarDays, title: "One calendar", text: "Everything that's due, on one family calendar." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-display text-xl font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Home className="size-5" /></span>HomeBase</div>
        <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-10 md:pt-20">
        <p className="mb-4 inline-block rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">For the whole family</p>
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] md:text-7xl">Your home, <span className="text-terracotta">running smoothly</span> — together.</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">Chores, appliances, warranties and service reminders, shared by everyone at home. Simple enough for every family member.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-xl px-7 text-base"><Link to="/auth">Get started</Link></Button>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card-surface p-6">
              <f.icon className="size-7 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
