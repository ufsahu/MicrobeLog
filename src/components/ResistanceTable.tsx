import { type DB, type Isolate, resistance, fmtPct, pctZone, zoneClass } from "@/lib/data";
import { names, useLang } from "@/lib/i18n";

/** Antibiotic × resistance table for an already first-isolate-deduplicated list. */
export function ResistanceTable({ db, list }: { db: DB; list: Isolate[] }) {
  const { t, lang } = useLang();
  const n = names(db, lang);
  const rows = resistance(list, db.meta.antibiotics.length).filter((r) => r.n > 0);
  if (!rows.length) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
          <th className="py-2 pr-2">{t("antibiotic")}</th><th className="px-2">WHONET</th><th className="px-2 text-right">{t("tested")}</th>
          <th className="px-2 text-right">R</th><th className="px-2 text-right">S</th><th className="w-1/3 px-2">{t("r_pct")}</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const z = pctZone(r.pct);
            return (
              <tr key={r.ab} className="border-b border-border/60">
                <td className="py-2 pr-2 font-medium">{n.ab(r.ab)}<div className="text-xs text-muted-foreground">{db.meta.antibiotics[r.ab].class}</div></td>
                <td className="px-2 font-mono text-xs">{db.meta.antibiotics[r.ab].antibiotic_code}</td>
                <td className="px-2 text-right tabular-nums">{r.n}</td>
                <td className="px-2 text-right tabular-nums">{r.r}</td>
                <td className="px-2 text-right tabular-nums">{r.n - r.r}</td>
                <td className="px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      {r.pct !== null && <div className={`h-full ${z === "high" ? "bg-risk-high" : z === "mid" ? "bg-risk-mid" : "bg-risk-low"}`} style={{ width: `${Math.min(100, r.pct)}%` }} />}
                    </div>
                    <span className={`w-16 rounded border px-1.5 py-0.5 text-center text-xs font-semibold ${zoneClass[z]}`}>{fmtPct(r.pct)}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
