import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { PageHeader, Panel, Stat } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { ResistanceTable } from "@/components/ResistanceTable";
import { useDB, applyFilters, firstIsolates, defaultFilters, type Filters, lastNDays, resistanceFor, fmtPct, MIN_ISOLATES } from "@/lib/data";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/monitoring")({
  head: () => seo("Susceptibility monitoring", "Continuously updated antimicrobial susceptibility monitor: previous four weeks and annual results with filters."),
  component: Monitoring,
});

function Monitoring() {
  const { data: db, dataUpdatedAt } = useDB();
  const { t, lang } = useLang();
  const [f, setF] = useState<Filters>(defaultFilters);
  const [ab, setAb] = useState(8); // ciprofloxacin
  const m = useMemo(() => {
    if (!db) return null;
    const base = applyFilters(db, db.isolates, f);
    const recentRaw = base.filter(lastNDays(db, 28));
    const recent = firstIsolates(recentRaw); // period = 4-week window
    const recentCultures = db.cultures.filter(lastNDays(db, 28));
    const years = [2023, 2024, 2025, 2026].map((y) => {
      const l = firstIsolates(base.filter((i) => i.year === y), (i) => i.year);
      return { y, l };
    });
    // rolling 13-week (quarter) windows, first isolate per window
    const weeks: { label: string; pct: number | null; n: number }[] = [];
    const DAY = 86400000;
    for (let end = db.maxT; end > db.minT + 90 * DAY; end -= 28 * DAY) {
      const win = firstIsolates(base.filter((i) => i.t > end - 91 * DAY && i.t <= end));
      const r = resistanceFor(win, ab);
      weeks.unshift({ label: new Date(end).toISOString().slice(0, 7), pct: r.pct, n: r.n });
    }
    return { recent, recentRaw: recentRaw.length, recentCultures: recentCultures.length, years, weeks };
  }, [db, f, ab]);
  if (!db || !m) return null;
  const n = names(db, lang);
  const from = new Date(db.maxT - 27 * 86400000).toISOString().slice(0, 10);
  const to = new Date(db.maxT).toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={t("monitoring")}
        sub={lang === "en" ? `Live monitor — refreshes automatically when new data arrives (last checked ${new Date(dataUpdatedAt).toLocaleTimeString()}).` : `Jatkuvasti päivittyvä seuranta — päivittyy automaattisesti uuden aineiston saapuessa (tarkistettu ${new Date(dataUpdatedAt).toLocaleTimeString()}).`} />
      <FilterBar db={db} f={f} set={setF} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="accent" label={t("last4")} value={`${from} → ${to}`} hint={lang === "en" ? "rolling 28-day window" : "liukuva 28 päivän jakso"} />
        <Stat label={t("cultures_n")} value={m.recentCultures} hint={t("last4")} />
        <Stat label={t("isolates_n")} value={`${m.recentRaw} → ${m.recent.length}`} hint={lang === "en" ? "all → first isolates" : "kaikki → ensimmäiset"} />
        <Stat label="ESBL / MRSA" value={`${m.recent.filter((i) => i.esbl).length} / ${m.recent.filter((i) => i.mrsa).length}`} hint={t("last4")} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={`${t("last4")} — ${t("r_pct")}`}>
          {m.recent.length < MIN_ISOLATES && <p className="mb-2 rounded-lg bg-risk-mid-soft px-3 py-2 text-xs">{lang === "en" ? "Fewer than 30 isolates in this window — widen the filters to see percentages." : "Alle 30 isolaattia tällä jaksolla — laajenna rajauksia nähdäksesi prosentit."}</p>}
          <ResistanceTable db={db} list={m.recent} />
        </Panel>
        <Panel title={`${t("annual")} — ${t("r_pct")}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="py-2">{t("antibiotic")}</th>{m.years.map((y) => <th key={y.y} className="px-2 text-right">{y.y}<div className="font-normal normal-case">n={y.l.length}</div></th>)}</tr></thead>
              <tbody>{db.meta.antibiotics.map((a, k) => {
                const cells = m.years.map((y) => resistanceFor(y.l, k));
                if (cells.every((c) => !c.n)) return null;
                return <tr key={k} className="border-b border-border/60"><td className="py-1.5">{n.ab(k)}</td>{cells.map((c, j) => <td key={j} className="px-2 text-right tabular-nums">{c.n ? fmtPct(c.pct) : "—"}</td>)}</tr>;
              })}</tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{lang === "en" ? "2023 covers Oct–Dec only; 2026 runs to the latest data." : "2023 kattaa vain loka–joulukuun; 2026 viimeisimpään tietoon asti."}</p>
        </Panel>
      </div>
      <Panel className="mt-4" title={`${t("trend")} — ${n.ab(ab)} (${lang === "en" ? "rolling 13-week windows" : "liukuvat 13 viikon jaksot"})`}
        right={<select value={ab} onChange={(e) => setAb(+e.target.value)} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">{db.meta.antibiotics.map((_, k) => <option key={k} value={k}>{n.ab(k)}</option>)}</select>}>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={m.weeks}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" fontSize={11} /><YAxis unit="%" fontSize={11} />
              <Tooltip formatter={(v: number, _k, p) => [`${v?.toFixed(1)}% (n=${(p.payload as { n: number }).n})`, t("r_pct")]} />
              <ReferenceLine y={20} stroke="var(--risk-high)" strokeDasharray="4 4" /><ReferenceLine y={10} stroke="var(--risk-mid)" strokeDasharray="4 4" />
              <Line dataKey="pct" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}
