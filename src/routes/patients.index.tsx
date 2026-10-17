import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { useDB, zoneClass } from "@/lib/data";
import { patientRisk } from "@/lib/clinical";
import { useLang } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/patients/")({
  head: () => seo("Patients", "Search patients and open individual culture, isolate and susceptibility histories."),
  component: PatientList,
});

function PatientList() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const [q, setQ] = useState("");
  const [onlyRisk, setOnlyRisk] = useState(false);
  const list = useMemo(() => {
    if (!db) return [];
    const ql = q.trim().toLowerCase();
    let ps = db.patients.filter((p) => !ql || p.id.toLowerCase().includes(ql) || p.area.toLowerCase().includes(ql));
    let rows = ps.map((p) => ({ p, r: patientRisk(db, p) }));
    if (onlyRisk) rows = rows.filter((x) => x.r.level === "high");
    return rows.sort((a, b) => b.r.score - a.r.score).slice(0, 100);
  }, [db, q, onlyRisk]);
  if (!db) return null;
  return (
    <>
      <PageHeader title={t("patients")} sub={lang === "en" ? "Sorted by illustrative risk score. Showing up to 100 results." : "Järjestetty havainnollistavan riskipisteen mukaan. Enintään 100 tulosta."} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="P000123…" className="h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm" />
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm"><input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} />{t("risk")}: {t("high")}</label>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {list.map(({ p, r }) => (
          <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground">{p.sex}</div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm font-semibold">{p.id}</div>
              <div className="text-xs text-muted-foreground">{p.birth} · {p.area} · {r.cultures.length} {t("cultures_n").toLowerCase()} · {r.reasons.join(", ")}</div>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${zoneClass[r.level]}`}>{r.score}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </>
  );
}
