import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { ShieldAlert, Bot, Microscope, Radar, Users } from "lucide-react";
import { PageHeader, Panel, Stat } from "@/components/AppShell";
import { useDB, firstIsolates, resistanceFor, fmtPct, MIN_ISOLATES } from "@/lib/data";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Antimicrobial surveillance dashboard", "MicrobeLog: hospital and patient dashboard for culture, isolate and antimicrobial resistance surveillance in English and Finnish."),
  component: Overview,
});

function Overview() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const d = useMemo(() => {
    if (!db) return null;
    const ecoli = db.meta.organisms.indexOf("Escherichia coli");
    const saur = db.meta.organisms.indexOf("Staphylococcus aureus");
    const latestYear = new Date(db.maxT).getUTCFullYear();
    const urineE = firstIsolates(db.isolates.filter((i) => i.org === ecoli && i.spec === 0 && i.year === latestYear), (i) => i.year);
    const sexChart = db.meta.antibiotics.map((a, k) => {
      const f = resistanceFor(urineE.filter((i) => i.sex === "F"), k), m = resistanceFor(urineE.filter((i) => i.sex === "M"), k);
      return { code: a.antibiotic_code, k, F: f.pct, M: m.pct, nF: f.n, nM: m.n };
    }).filter((r) => r.F !== null || r.M !== null);
    const firstAll = firstIsolates(db.isolates, (i) => i.year);
    const pheno = {
      esbl: firstAll.filter((i) => i.esbl).length, mrsa: firstAll.filter((i) => i.mrsa).length,
      vre: firstAll.filter((i) => i.vre).length, cpe: firstAll.filter((i) => i.cpe).length,
      saur: firstAll.filter((i) => i.org === saur).length,
    };
    const results = [0, 0, 0]; db.cultures.forEach((c) => results[c.result]++);
    return { latestYear, sexChart, pheno, nUrineE: urineE.length, results, firstAll: firstAll.length };
  }, [db]);
  if (!db || !d) return null;
  const n = names(db, lang);
  const susTests = db.isolates.reduce((s, i) => s + i.sus.replace(/\./g, "").length, 0);

  return (
    <>
      <PageHeader title={t("overview")} sub={lang === "en" ? "Culture → 0–2 isolates → susceptibility results. Period 2023-10-02 to 2026-09-27 (156 weeks)." : "Näyte (viljely) → 0–2 isolaattia → herkkyysmääritykset. Aikaväli 02.10.2023–27.09.2026 (156 viikkoa)."} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="accent" label={t("patients_n")} value={db.patients.length.toLocaleString()} hint="patients.csv" />
        <Stat label={t("cultures_n")} value={db.cultures.length.toLocaleString()} hint={d.results.map((r, i) => `${n.result(i)} ${((100 * r) / db.cultures.length).toFixed(0)}%`).join(" · ")} />
        <Stat label={t("isolates_n")} value={db.isolates.length.toLocaleString()} hint={`${d.firstAll.toLocaleString()} ${lang === "en" ? "first isolates / year" : "ensimmäistä isolaattia / vuosi"}`} />
        <Stat label={t("sus_n")} value={susTests.toLocaleString()} hint="S / R · EUCAST 2023–2026" />
      </div>

      <div className="mt-4 rounded-xl border border-accent/40 bg-card p-4 shadow-card">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div><div className="font-semibold">{t("rule_title")}</div><p className="text-sm text-muted-foreground">{t("rule_text")}</p></div></div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={`${t("sex_diff")} · ${d.latestYear}`} right={<span className="text-xs text-muted-foreground">n = {d.nUrineE}</span>}>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={d.sexChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="code" fontSize={12} /><YAxis unit="%" fontSize={12} />
                <Tooltip formatter={(v: number) => `${v?.toFixed(1)}%`} labelFormatter={(c) => { const r = d.sexChart.find((x) => x.code === c); return r ? n.ab(r.k) : c; }} />
                <Legend />
                <Bar dataKey="F" name={t("female")} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="M" name={t("male")} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{lang === "en" ? `Bars hidden where fewer than ${MIN_ISOLATES} first isolates were tested.` : `Palkki piilotetaan, jos testattuja ensimmäisiä isolaatteja on alle ${MIN_ISOLATES}.`}</p>
        </Panel>
        <Panel title={t("phenotypes")}>
          <ul className="space-y-3 text-sm">
            {[["ESBL", d.pheno.esbl, "Enterobacterales"], ["MRSA", d.pheno.mrsa, `${fmtPct((100 * d.pheno.mrsa) / d.pheno.saur)} S. aureus`], ["VRE", d.pheno.vre, "Enterococcus"], ["CPE", d.pheno.cpe, "carbapenemase"]].map(([k, v, h]) => (
              <li key={k as string} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                <span><span className="font-semibold">{k}</span> <span className="text-xs text-muted-foreground">{h}</span></span>
                <span className="font-display text-lg font-semibold">{v}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{ to: "/monitoring", icon: Radar, k: "monitoring" as const }, { to: "/patients", icon: Users, k: "patients" as const }, { to: "/microscopy", icon: Microscope, k: "microscopy" as const }, { to: "/chat", icon: Bot, k: "chat" as const }].map(({ to, icon: I, k }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 font-medium shadow-card transition hover:border-primary">
            <I className="h-5 w-5 text-accent" />{t(k)}
          </Link>
        ))}
      </div>
    </>
  );
}
