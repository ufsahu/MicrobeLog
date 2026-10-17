import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel } from "@/components/AppShell";
import { useDB, quantityZone, zoneClass, quantityLabel } from "@/lib/data";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/explorer")({
  head: () => seo("Dataset explorer", "Browse every column of cultures, isolates, susceptibility, patients, wards and antibiotics datasets."),
  component: Explorer,
});

type Tab = "cultures" | "isolates" | "susceptibility" | "patients" | "wards" | "antibiotics";
const PAGE = 50;

function Explorer() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const [tab, setTab] = useState<Tab>("cultures");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const table = useMemo(() => {
    if (!db) return null;
    const n = names(db, lang);
    const P = (i: number) => db.patients[i].id;
    let head: string[] = [];
    let rows: (string | number)[][] = [];
    if (tab === "cultures") {
      head = ["culture_id", "patient_id", "age_years", "sample_date", "iso_year", "iso_week", "ward_code", lang === "fi" ? "ward_fi" : "ward_en", "ward_type", "institution", "admission_date", "specimen", "specimen_fi", "result", "n_isolates"];
      rows = db.cultures.map((c) => { const w = db.meta.wards[c.ward]; return [c.id, P(c.p), c.age, c.date, c.year, c.week, w.ward_code, n.ward(c.ward), w.ward_type, w.institution, c.adm, db.meta.specimens[c.spec], db.meta.specimens_fi[c.spec], db.meta.results[c.result], c.n]; });
    } else if (tab === "isolates") {
      head = ["isolate_id", "culture_id", "patient_id", "isolate_no", "organism", "quantity", "esbl", "mrsa", "vre", "cpe"];
      rows = db.isolates.map((i) => [i.id, db.cultures[i.c].id, P(i.p), i.no, db.meta.organisms[i.org], db.meta.quantities[i.qty] + "|" + i.spec, +i.esbl, +i.mrsa, +i.vre, +i.cpe]);
    } else if (tab === "susceptibility") {
      head = ["isolate_id", "culture_id", "organism", "antibiotic", "antibiotic_code", "antibiotic_fi", "result", "guideline"];
      for (const i of db.isolates) for (let k = 0; k < i.sus.length; k++) if (i.sus[k] !== ".") {
        const a = db.meta.antibiotics[k];
        rows.push([i.id, db.cultures[i.c].id, db.meta.organisms[i.org], a.antibiotic, a.antibiotic_code, a.antibiotic_fi, i.sus[k], db.meta.guidelines[i.guide] ?? ""]);
      }
    } else if (tab === "patients") {
      head = ["patient_id", "sex", "birth_year", "home_area", "n_cultures"];
      rows = db.patients.map((p) => [p.id, p.sex, p.birth, p.area, db.culturesByPatient.get(p.idx)?.length ?? 0]);
    } else if (tab === "wards") {
      head = ["ward_code", "ward_fi", "ward_en", "ward_type", "institution"];
      rows = db.meta.wards.map((w) => [w.ward_code, w.ward_fi, w.ward_en, w.ward_type, w.institution]);
    } else {
      head = ["antibiotic", "antibiotic_code", "antibiotic_fi", "class", "reported_for"];
      rows = db.meta.antibiotics.map((a) => [a.antibiotic, a.antibiotic_code, a.antibiotic_fi, a.class, a.reported_for]);
    }
    const ql = q.trim().toLowerCase();
    if (ql) rows = rows.filter((r) => r.some((v) => String(v).toLowerCase().includes(ql)));
    return { head, rows };
  }, [db, tab, q, lang]);
  if (!db || !table) return null;
  const pages = Math.max(1, Math.ceil(table.rows.length / PAGE));
  const view = table.rows.slice(page * PAGE, page * PAGE + PAGE);
  const tabs: Tab[] = ["cultures", "isolates", "susceptibility", "patients", "wards", "antibiotics"];

  const cell = (h: string, v: string | number) => {
    if (h === "patient_id") return <Link to="/patients/$id" params={{ id: String(v) }} className="font-mono text-primary underline-offset-2 hover:underline">{v}</Link>;
    if (h === "result" && (v === "R" || v === "S")) return <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${v === "R" ? "bg-risk-high-soft text-risk-high" : "bg-risk-low-soft text-risk-low"}`}>{v}</span>;
    if (h === "quantity") { const [qv, sp] = String(v).split("|"); const z = quantityZone(qv, +sp); return <span className={`rounded border px-1.5 py-0.5 text-xs ${zoneClass[z]}`}>{quantityLabel(qv, +sp)}</span>; }
    if (["esbl", "mrsa", "vre", "cpe"].includes(h)) return v ? <span className="rounded bg-accent px-1.5 text-xs font-bold text-accent-foreground">1</span> : <span className="text-muted-foreground">0</span>;
    if (h === "organism") return <i>{v}</i>;
    return v;
  };

  return (
    <>
      <PageHeader title={t("explorer")} sub={lang === "en" ? "Every column from every CSV file. Keys: patient_id → culture_id → isolate_id. Tap a patient ID to open the patient view." : "Kaikki sarakkeet kaikista CSV-tiedostoista. Avaimet: patient_id → culture_id → isolate_id. Napauta potilastunnusta avataksesi potilasnäkymän."} />
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((x) => <button key={x} onClick={() => { setTab(x); setPage(0); }} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${tab === x ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{x}.csv</button>)}
      </div>
      <Panel title={`${tab}.csv · ${table.rows.length.toLocaleString()} ${lang === "en" ? "rows" : "riviä"}`}
        right={<input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={t("search")} className="h-9 w-48 rounded-lg border border-input bg-card px-3 text-sm" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">{table.head.map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>{view.map((r, i) => <tr key={i} className="border-b border-border/50 hover:bg-muted/50">{r.map((v, j) => <td key={j} className="whitespace-nowrap px-2 py-1.5">{cell(table.head[j], v)}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">←</button>
          <span className="text-muted-foreground">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">→</button>
        </div>
      </Panel>
    </>
  );
}
