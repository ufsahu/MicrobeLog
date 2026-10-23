import { Link } from "@tanstack/react-router";
import { ArrowLeft, Microscope } from "lucide-react";
import { PageHeader, Panel, Stat } from "@/components/AppShell";
import { useDB, quantityZone, quantityLabel, zoneClass } from "@/lib/data";
import { patientRisk, predictCondition, condText } from "@/lib/clinical";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";
import { imageForOrganism } from "@/lib/micro-images";


export function PatientView({ id, patientMode }: { id: string; patientMode?: boolean }) {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  if (!db) return null;
  const p = db.patients.find((x) => x.id === id);
  if (!p) return <p>{id} — not found</p>;
  const n = names(db, lang);
  const r = patientRisk(db, p);
  const cultures = [...r.cultures].sort((a, b) => b.t - a.t);

  return (
    <>
      {!patientMode && <Link to="/patients" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />{t("patients")}</Link>}
      <PageHeader title={p.id} sub={t("disclaimer")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat tone="accent" label={t("sex")} value={p.sex === "F" ? t("female") : t("male")} />
        <Stat label="birth_year" value={p.birth} hint={`${lang === "en" ? "age at last sample" : "ikä viim. näytteessä"} ${r.age}`} />
        <Stat label={t("area")} value={p.area} />
        <Stat label={t("cultures_n")} value={r.cultures.length} hint={`${r.isolates.length} ${t("isolates_n").toLowerCase()}`} />
        <div className={`rounded-xl border p-4 shadow-card ${zoneClass[r.level]}`}><div className="text-xs font-medium uppercase">{t("risk")}</div><div className="font-display text-2xl font-semibold">{r.score}/100</div><div className="text-xs">{r.reasons.join(" · ") || "—"}</div></div>
      </div>
      <div className="mt-4 space-y-4">
        {cultures.map((c) => {
          const isos = (db.isolatesByCulture.get(c.idx) ?? []).map((i) => db.isolates[i]);
          const cond = predictCondition(db, c, isos, p);
          const w = db.meta.wards[c.ward];
          return (
            <Panel key={c.id} title={<span className="font-mono">{c.id}</span>}
              right={<span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.result === 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{n.result(c.result)}</span>}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                {[["sample_date", c.date], ["iso_year / week", `${c.year} / W${c.week}`], [t("specimen"), n.spec(c.spec)], ["age_years", c.age], [t("ward"), `${w.ward_code} · ${n.ward(c.ward)}`], [t("ward_type"), w.ward_type === "in" ? t("inpatient") : t("outpatient")], [t("institution"), t(w.institution as "hospital")], ["admission_date", c.adm || "—"]].map(([k, v]) => (
                  <div key={String(k)}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>))}
              </dl>
              {c.hai && <div className="mt-2 inline-block rounded bg-risk-mid-soft px-2 py-0.5 text-xs font-semibold">{t("hai")}</div>}
              {cond && (() => { const ct = condText(cond, lang); return (
                <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${zoneClass[cond.level]}`}><span className="font-semibold">{t("condition")}: {ct.name}</span> <span className="text-xs">({ct.why})</span></div>); })()}
              {isos.map((i) => {
                const q = db.meta.quantities[i.qty]; const z = quantityZone(q, i.spec); const img = imageForOrganism(db.meta.organisms[i.org]);
                return (
                  <div key={i.id} className="mt-3 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{i.id}</span>
                      <span className="font-semibold italic">{db.meta.organisms[i.org]}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-xs ${zoneClass[z]}`}>{quantityLabel(q, i.spec)}</span>
                      {(["esbl", "mrsa", "vre", "cpe"] as const).filter((k) => i[k]).map((k) => <span key={k} className="rounded bg-destructive px-1.5 py-0.5 text-xs font-bold uppercase text-destructive-foreground">{k}</span>)}
                      <span className="text-xs text-muted-foreground">{db.meta.guidelines[i.guide]}</span>
                      {img && !patientMode && <Link to="/microscopy" search={{ img: img.key }} className="ml-auto inline-flex items-center gap-1 text-xs text-primary"><Microscope className="h-3.5 w-3.5" />{t("microscopy")}</Link>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {i.sus.split("").map((s, k) => s === "." ? null : (
                        <span key={k} title={n.ab(k)} className={`rounded border px-1.5 py-0.5 font-mono text-xs ${s === "R" ? "border-risk-high/30 bg-risk-high-soft text-risk-high" : "border-risk-low/30 bg-risk-low-soft text-risk-low"}`}>{db.meta.antibiotics[k].antibiotic_code} {s}</span>))}
                    </div>
                  </div>
                );
              })}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
