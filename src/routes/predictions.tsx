import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { PageHeader, Panel } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { useDB, applyFilters, defaultFilters, type Filters, firstIsolates, resistanceFor, linreg, zoneClass } from "@/lib/data";
import { predictCondition, condText } from "@/lib/clinical";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/predictions")({
  head: () => seo("Predictions", "Resistance forecasts and rule-based likely condition estimates from culture and isolate data."),
  component: Predictions,
});

function Predictions() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const [f, setF] = useState<Filters>({ ...defaultFilters, org: 2, spec: 0 });
  const [ab, setAb] = useState(8);
  const d = useMemo(() => {
    if (!db) return null;
    const base = applyFilters(db, db.isolates, f);
    const q = (i: { date: string }) => i.date.slice(0, 4) + "-Q" + (Math.floor((+i.date.slice(5, 7) - 1) / 3) + 1);
    const quarters = [...new Set(base.map(q))].sort();
    const first = firstIsolates(base, q);
    const pts = quarters.map((k, x) => { const r = resistanceFor(first.filter((i) => q(i) === k), ab); return { x, k, pct: r.pct, n: r.n }; });
    const valid = pts.filter((p) => p.pct !== null).map((p) => ({ x: p.x, y: p.pct! }));
    const { a, b } = linreg(valid);
    const chart = pts.map((p) => ({ label: p.k, observed: p.pct, fit: valid.length > 1 ? a + b * p.x : null, forecast: null as number | null }));
    for (let h = 1; h <= 4; h++) { const x = pts.length - 1 + h; chart.push({ label: `+${h}Q`, observed: null, fit: null, forecast: Math.max(0, a + b * x) }); }
    if (chart.length > 4) chart[pts.length - 1].forecast = chart[pts.length - 1].fit;
    // condition distribution among positive cultures
    const counts = new Map<string, { c: ReturnType<typeof predictCondition>; n: number }>();
    const cultIdx = new Set(base.map((i) => i.c));
    cultIdx.forEach((ci) => {
      const c = db.cultures[ci]; const isos = (db.isolatesByCulture.get(ci) ?? []).map((i) => db.isolates[i]);
      const cond = predictCondition(db, c, isos, db.patients[c.p]); if (!cond) return;
      const e = counts.get(cond.en) ?? { c: cond, n: 0 }; e.n++; counts.set(cond.en, e);
    });
    const conds = [...counts.values()].sort((x, y) => y.n - x.n);
    return { chart, slope: b, conds, total: cultIdx.size, next: Math.max(0, a + b * (pts.length + 3)) };
  }, [db, f, ab]);
  if (!db || !d) return null;
  const n = names(db, lang);
  return (
    <>
      <PageHeader title={t("predictions")} sub={t("disclaimer")} />
      <FilterBar db={db} f={f} set={setF} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={`${t("forecast")}: ${n.ab(ab)} ${t("r_pct")}`}
          right={<select value={ab} onChange={(e) => setAb(+e.target.value)} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">{db.meta.antibiotics.map((_, k) => <option key={k} value={k}>{n.ab(k)}</option>)}</select>}>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={d.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" fontSize={11} /><YAxis unit="%" fontSize={11} />
                <Tooltip formatter={(v: number) => (v == null ? "—" : `${v.toFixed(1)}%`)} /><Legend />
                <Line dataKey="observed" name={lang === "en" ? "Observed (quarterly, first isolates)" : "Havaittu (neljännes, ensimmäiset)"} stroke="var(--chart-1)" strokeWidth={2.5} connectNulls />
                <Line dataKey="fit" name={lang === "en" ? "Linear trend" : "Lineaarinen trendi"} stroke="var(--muted-foreground)" strokeDasharray="4 4" dot={false} />
                <Line dataKey="forecast" name={t("forecast")} stroke="var(--chart-2)" strokeWidth={2.5} strokeDasharray="6 3" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm">{lang === "en" ? `Trend ${d.slope >= 0 ? "+" : ""}${d.slope.toFixed(2)} percentage points per quarter; projected ${d.next.toFixed(1)}% in 4 quarters.` : `Trendi ${d.slope >= 0 ? "+" : ""}${d.slope.toFixed(2)} %-yksikköä / neljännes; ennuste ${d.next.toFixed(1)} % neljän neljänneksen päästä.`}</p>
        </Panel>
        <Panel title={`${t("condition")} · ${d.total} ${t("cultures_n").toLowerCase()}`}>
          <ul className="space-y-2">{d.conds.map(({ c, n: cnt }) => { const ct = condText(c!, lang); return (
            <li key={c!.en} className={`rounded-lg border px-3 py-2 text-sm ${zoneClass[c!.level]}`}><div className="flex justify-between gap-2"><span className="font-semibold">{ct.name}</span><span className="tabular-nums">{((100 * cnt) / d.total).toFixed(1)}%</span></div></li>); })}</ul>
          <p className="mt-3 text-xs text-muted-foreground">{lang === "en" ? "Rules: specimen type, quantity threshold, sex, age ≥ 75, ward, surgical ward, resistance phenotype." : "Säännöt: näytetyyppi, määrän raja-arvo, sukupuoli, ikä ≥ 75, osasto, kirurgia, resistenssi-ilmiasu."}</p>
        </Panel>
      </div>
    </>
  );
}
