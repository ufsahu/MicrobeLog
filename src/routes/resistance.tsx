import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { ResistanceTable } from "@/components/ResistanceTable";
import { useDB, applyFilters, firstIsolates, defaultFilters, type Filters, fmtPct, pctZone, zoneClass, resistanceFor } from "@/lib/data";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/resistance")({
  head: () => seo("Resistance rates", "First-isolate antimicrobial resistance percentages by organism, specimen, sex and year, shown only with at least 30 isolates."),
  component: ResistancePage,
});

function ResistancePage() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const [f, setF] = useState<Filters>({ ...defaultFilters, org: 4, spec: 0 });
  const [year, setYear] = useState<number | -1>(-1);
  const years = [2023, 2024, 2025, 2026];
  const data = useMemo(() => {
    if (!db) return null;
    const raw = applyFilters(db, db.isolates, f).filter((i) => year === -1 || i.year === year);
    const first = firstIsolates(raw, (i) => i.year);
    return { raw: raw.length, first };
  }, [db, f, year]);
  const matrix = useMemo(() => {
    if (!db) return null;
    const base = applyFilters(db, db.isolates, { ...f, org: -1 }).filter((i) => year === -1 || i.year === year);
    const first = firstIsolates(base, (i) => i.year);
    return db.meta.organisms.map((_, o) => { const l = first.filter((i) => i.org === o); return { o, n: l.length, cells: db.meta.antibiotics.map((_, k) => resistanceFor(l, k)) }; });
  }, [db, f, year]);
  if (!db || !data || !matrix) return null;
  const n = names(db, lang);

  return (
    <>
      <PageHeader title={t("resistance")} sub={t("rule_text")}
        right={<div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">{[-1, ...years].map((y) => (
          <button key={y} onClick={() => setYear(y)} className={`rounded-md px-3 py-1 ${year === y ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{y === -1 ? t("all") : y}</button>))}</div>} />
      <FilterBar db={db} f={f} set={setF} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={`${f.org === -1 ? t("all") : db.meta.organisms[f.org]} · ${f.spec === -1 ? t("all") : n.spec(f.spec)}`}
          right={<span className="text-xs text-muted-foreground">{data.raw} → {data.first.length} {lang === "en" ? "first isolates" : "ensimmäistä isolaattia"}</span>}>
          <ResistanceTable db={db} list={data.first} />
        </Panel>
        <Panel title={lang === "en" ? "How it is computed" : "Laskentatapa"}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{lang === "en" ? "Filter isolates by your selections." : "Rajaa isolaatit valintojesi mukaan."}</li>
            <li>{lang === "en" ? "Sort by sample date; keep the first isolate per patient × species × specimen type × calendar year." : "Järjestä näytepäivän mukaan; säilytä ensimmäinen isolaatti per potilas × laji × näytetyyppi × vuosi."}</li>
            <li>{lang === "en" ? "R% = R ÷ (R + S) per antibiotic from susceptibility.csv 'result'." : "R% = R ÷ (R + S) antibiooteittain susceptibility.csv:n 'result'-sarakkeesta."}</li>
            <li>{lang === "en" ? "Show the % only if ≥ 30 isolates were tested." : "Näytä % vain jos testattuja ≥ 30."}</li>
          </ol>
          <div className="mt-4 space-y-1 text-xs">
            <div className={`rounded border px-2 py-1 ${zoneClass.low}`}>&lt; 10% — {t("low")}</div>
            <div className={`rounded border px-2 py-1 ${zoneClass.mid}`}>10–20% — {t("mid")}</div>
            <div className={`rounded border px-2 py-1 ${zoneClass.high}`}>≥ 20% — {t("high")}</div>
          </div>
        </Panel>
      </div>
      <Panel className="mt-4" title={lang === "en" ? "Organism × antibiotic heatmap (first isolates)" : "Mikrobi × antibiootti -lämpökartta (ensimmäiset isolaatit)"}>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead><tr><th className="p-1 text-left">{t("organism")}</th><th className="p-1">n</th>{db.meta.antibiotics.map((a) => <th key={a.antibiotic_code} className="p-1 font-mono" title={n.ab(db.meta.antibiotics.indexOf(a))}>{a.antibiotic_code}</th>)}</tr></thead>
            <tbody>{matrix.map((row) => (
              <tr key={row.o}><td className="whitespace-nowrap p-1 italic">{db.meta.organisms[row.o]}</td><td className="p-1 text-right tabular-nums">{row.n}</td>
                {row.cells.map((c, k) => <td key={k} className="p-0.5"><div className={`min-w-12 rounded border px-1 py-1 text-center ${c.n ? zoneClass[pctZone(c.pct)] : "border-transparent text-muted-foreground"}`} title={`R ${c.r}/${c.n}`}>{c.n ? (c.pct === null ? "n<30" : c.pct.toFixed(0) + "%") : "·"}</div></td>)}
              </tr>))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
export { fmtPct };
