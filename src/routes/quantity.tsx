import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { useDB, applyFilters, defaultFilters, type Filters, quantityZone, quantityLabel, zoneClass } from "@/lib/data";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/quantity")({
  head: () => seo("Bacterial load", "Isolate quantity distribution as percentages with red, yellow and green risk thresholds for urine CFU/mL and wound growth."),
  component: QuantityPage,
});

const ZONES = {
  0: [[">=10^5", "high"], ["10^4", "mid"], ["10^3", "low"]],
  2: [["+++", "high"], ["++", "mid"], ["+", "low"]],
} as const;

function QuantityPage() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const [f, setF] = useState<Filters>(defaultFilters);
  const d = useMemo(() => {
    if (!db) return null;
    const l = applyFilters(db, db.isolates, { ...f, spec: -1 });
    const by = (spec: number) => {
      const s = l.filter((i) => i.spec === spec); const c: Record<string, number> = {};
      s.forEach((i) => { const q = db.meta.quantities[i.qty]; c[q] = (c[q] ?? 0) + 1; });
      return { total: s.length, c };
    };
    const orgRows = db.meta.organisms.map((o, k) => {
      const s = l.filter((i) => i.org === k && i.spec !== 1); const hi = s.filter((i) => quantityZone(db.meta.quantities[i.qty], i.spec) === "high").length;
      return { o, n: s.length, hi, pct: s.length ? (100 * hi) / s.length : 0 };
    }).sort((a, b) => b.pct - a.pct);
    return { urine: by(0), wound: by(2), blood: by(1), orgRows };
  }, [db, f]);
  if (!db || !d) return null;
  const n = names(db, lang);
  const zoneName = { high: t("high"), mid: t("mid"), low: t("low") };

  const Gauge = ({ spec, data }: { spec: 0 | 2; data: { total: number; c: Record<string, number> } }) => (
    <Panel title={`${n.spec(spec)} · n = ${data.total}`}>
      <div className="flex h-8 overflow-hidden rounded-lg">
        {ZONES[spec].map(([q, z]) => { const p = data.total ? (100 * (data.c[q] ?? 0)) / data.total : 0; return (
          <div key={q} style={{ width: `${p}%` }} className={`flex items-center justify-center text-xs font-bold ${z === "high" ? "bg-risk-high text-destructive-foreground" : z === "mid" ? "bg-risk-mid text-foreground" : "bg-risk-low text-destructive-foreground"}`}>{p >= 8 ? `${p.toFixed(0)}%` : ""}</div>); })}
      </div>
      <div className="mt-4 space-y-2">
        {ZONES[spec].map(([q, z]) => { const cnt = data.c[q] ?? 0; const p = data.total ? (100 * cnt) / data.total : 0; return (
          <div key={q} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${zoneClass[z]}`}>
            <span><span className="font-semibold">{quantityLabel(q, spec)}</span> — {zoneName[z]}</span>
            <span className="tabular-nums font-semibold">{p.toFixed(1)}% <span className="font-normal opacity-70">({cnt})</span></span>
          </div>); })}
      </div>
    </Panel>
  );

  return (
    <>
      <PageHeader title={t("quantity")} sub={lang === "en" ? "isolates.csv 'quantity' shown as the share of isolates in each category." : "isolates.csv:n 'quantity' esitettynä isolaattien osuutena kussakin luokassa."} />
      <FilterBar db={db} f={f} set={setF} hide={["spec"]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Gauge spec={0} data={d.urine} />
        <Gauge spec={2} data={d.wound} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title={lang === "en" ? "Thresholds used" : "Käytetyt raja-arvot"} className="lg:col-span-2">
          <ul className="space-y-2 text-sm">
            <li><span className="font-semibold text-risk-high">● ≥ 10⁵ CFU/mL</span> — {lang === "en" ? "significant bacteriuria (Kass criterion): urinary tract infection likely. Risk zone." : "merkitsevä bakteriuria (Kassin kriteeri): virtsatieinfektio todennäköinen. Riskivyöhyke."}</li>
            <li><span className="font-semibold">● 10⁴ CFU/mL</span> — {lang === "en" ? "borderline: significant in symptomatic patients, men, catheter samples or primary pathogens (E. coli, S. saprophyticus ≥ 10³ in cystitis)." : "rajatapaus: merkitsevä oireisilla, miehillä, katetrinäytteissä tai primaaripatogeeneilla."}</li>
            <li><span className="font-semibold text-risk-low">● 10³ CFU/mL</span> — {lang === "en" ? "low count: often contamination or early infection; interpret with symptoms. Safer zone." : "vähäinen määrä: usein kontaminaatio tai alkava infektio; tulkitse oireiden mukaan. Turvallisempi vyöhyke."}</li>
            <li><span className="font-semibold">+ / ++ / +++</span> — {lang === "en" ? "wound semi-quantitative growth: scant / moderate / heavy." : "haavan puolikvantitatiivinen kasvu: niukka / kohtalainen / runsas."}</li>
            <li><span className="font-semibold text-risk-high">● {n.spec(1)}</span> — {lang === "en" ? `no quantity is reported; any growth is clinically significant (${d.blood.total} isolates).` : `määrää ei raportoida; mikä tahansa kasvu on kliinisesti merkitsevä (${d.blood.total} isolaattia).`}</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Sources: Kass EH 1956; European Urinalysis Guidelines (ECLM 2023); EAU Guidelines on Urological Infections.</p>
        </Panel>
        <Panel title={lang === "en" ? "High-load share by organism" : "Runsaan kasvun osuus mikrobeittain"}>
          <ul className="space-y-1.5 text-sm">{d.orgRows.filter((r) => r.n).map((r) => (
            <li key={r.o}><div className="flex justify-between"><i>{r.o}</i><span className="tabular-nums">{r.pct.toFixed(0)}%</span></div>
              <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-risk-high" style={{ width: `${r.pct}%` }} /></div></li>))}</ul>
        </Panel>
      </div>
    </>
  );
}
