import { FolderKanbanIcon, LineChartIcon, UsersIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { icon: FolderKanbanIcon, title: "Organize Expenses", text: "Keep everything in categories" },
  { icon: UsersIcon, title: "Manage Team Access", text: "Give users access to selected categories" },
  { icon: LineChartIcon, title: "Better Financial Visibility", text: "Make smarter decisions" },
];

const BARS = [38, 55, 44, 70, 58, 86];

export function LoginHero() {
  return (
    <section className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-sidebar-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-32 size-72 rounded-full bg-sidebar-primary/10 blur-3xl" />

      <Logo className="relative text-sidebar-accent-foreground" />

      <div className="relative mt-16 max-w-md space-y-4">
        <h1 className="text-4xl leading-tight font-bold text-sidebar-accent-foreground">
          Take control
          <br />
          of <span className="text-sidebar-primary">your money.</span>
        </h1>
        <p className="text-base text-sidebar-foreground/80">
          Track expenses, manage categories and share access with your team — all in one simple dashboard.
        </p>
      </div>

      <ul className="relative mt-10 space-y-5">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-sidebar-accent-foreground">{title}</span>
              <span className="block text-xs text-sidebar-foreground/70">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Illustrative mini chart */}
      <div className="relative mt-auto w-56 rounded-xl bg-white/95 p-4 shadow-xl" aria-hidden>
        <div className="mb-3 h-2 w-20 rounded-full bg-slate-200" />
        <div className="flex h-20 items-end gap-2">
          {BARS.map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-sidebar-primary" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </section>
  );
}
