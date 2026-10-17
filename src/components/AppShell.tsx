import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, BarChart3, Bot, Database, Download, FlaskConical, LayoutDashboard, Microscope, MoreHorizontal, Radar, TrendingUp, Users } from "lucide-react";
import logo from "@/assets/microbelog-logo.png";
import { useLang, type Key } from "@/lib/i18n";
import { useDB } from "@/lib/data";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const nav: { to: string; key: Key; icon: typeof Activity }[] = [
  { to: "/", key: "overview", icon: LayoutDashboard },
  { to: "/resistance", key: "resistance", icon: BarChart3 },
  { to: "/monitoring", key: "monitoring", icon: Radar },
  { to: "/explorer", key: "explorer", icon: Database },
  { to: "/patients", key: "patients", icon: Users },
  { to: "/quantity", key: "quantity", icon: FlaskConical },
  { to: "/predictions", key: "predictions", icon: TrendingUp },
  { to: "/microscopy", key: "microscopy", icon: Microscope },
  { to: "/export", key: "export", icon: Download },
  { to: "/chat", key: "chat", icon: Bot },
];
const mobileMain = ["/", "/monitoring", "/patients", "/chat"];

export function LangToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold ${compact ? "" : "shadow-card"}`}>
      {(["en", "fi"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`rounded-full px-3 py-1 uppercase transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function isActive(path: string, to: string) { return to === "/" ? path === "/" : path.startsWith(to); }

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: db, isLoading, error } = useDB();

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="m-3 rounded-xl bg-card px-3 py-3"><img src={logo} alt="MicrobeLog" width={1536} height={512} className="h-auto w-full" /></div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {nav.map(({ to, key, icon: Icon }) => (
            <Link key={to} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive(path, to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}>
              <Icon className={`h-4 w-4 ${isActive(path, to) ? "text-sidebar-primary" : ""}`} />{t(key)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs opacity-80">{t("synthetic")}</div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2 backdrop-blur lg:hidden">
        <img src={logo} alt="MicrobeLog" width={1536} height={512} className="h-8 w-auto" />
        <LangToggle compact />
      </header>

      <main className="pb-24 lg:pb-8 lg:pl-60">
        <div className="hidden items-center justify-end gap-3 px-8 pt-5 lg:flex">
          {db && <span className="text-xs text-muted-foreground">{t("updated")} {new Date(db.maxT).toISOString().slice(0, 10)}</span>}
          <LangToggle />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
          {isLoading ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Activity className="h-8 w-8 animate-pulse text-primary" />{t("loading")}
            </div>
          ) : error ? (
            <div className="text-destructive">{String(error)}</div>
          ) : children}
        </div>
      </main>

      {/* Mobile bottom tab bar (app navigation) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card pb-safe pt-1 lg:hidden">
        {nav.filter((n) => mobileMain.includes(n.to)).map(({ to, key, icon: Icon }) => (
          <Link key={to} to={to} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium ${isActive(path, to) ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />{t(key)}
          </Link>
        ))}
        <Sheet>
          <SheetTrigger className="flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-muted-foreground"><MoreHorizontal className="h-5 w-5" />{t("more")}</SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetTitle className="mb-3">{t("more")}</SheetTitle>
            <div className="grid grid-cols-3 gap-3 pb-4">
              {nav.filter((n) => !mobileMain.includes(n.to)).map(({ to, key, icon: Icon }) => (
                <Link key={to} to={to} className="flex flex-col items-center gap-2 rounded-xl bg-secondary p-3 text-center text-xs font-medium text-secondary-foreground">
                  <Icon className="h-5 w-5 text-primary" />{t(key)}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold lg:text-3xl">{title}</h1>{sub && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sub}</p>}</div>
      {right}
    </div>
  );
}

export function Panel({ title, children, right, className = "" }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 shadow-card ${className}`}>
      {(title || right) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-semibold">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "accent" }) {
  return (
    <div className={`rounded-xl border border-border p-4 shadow-card ${tone === "accent" ? "bg-hero text-primary-foreground" : "bg-card"}`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${tone === "accent" ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
      {hint && <div className={`mt-1 text-xs ${tone === "accent" ? "opacity-80" : "text-muted-foreground"}`}>{hint}</div>}
    </div>
  );
}
