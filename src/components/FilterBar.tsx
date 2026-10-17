import type { ReactElement } from "react";
import { type DB, type Filters, defaultFilters } from "@/lib/data";
import { names, useLang } from "@/lib/i18n";

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function FilterBar({ db, f, set, hide = [] }: { db: DB; f: Filters; set: (f: Filters) => void; hide?: (keyof Filters)[] }) {
  const { t, lang } = useLang();
  const n = names(db, lang);
  const all: [string, string] = ["-1", t("all")];
  const up = <K extends keyof Filters>(k: K, v: Filters[K]) => set({ ...f, [k]: v });
  const items: [keyof Filters, ReactElement][] = [
    ["org", <Sel key="o" label={t("organism")} value={String(f.org)} onChange={(v) => up("org", +v)} opts={[all, ...db.meta.organisms.map((o, i) => [String(i), o] as [string, string])]} />],
    ["spec", <Sel key="s" label={t("specimen")} value={String(f.spec)} onChange={(v) => up("spec", +v)} opts={[all, ...db.meta.specimens.map((_, i) => [String(i), n.spec(i)] as [string, string])]} />],
    ["sex", <Sel key="x" label={t("sex")} value={f.sex} onChange={(v) => up("sex", v as Filters["sex"])} opts={[["all", t("all")], ["F", t("female")], ["M", t("male")]]} />],
    ["age", <Sel key="a" label={t("age")} value={f.age} onChange={(v) => up("age", v as Filters["age"])} opts={[["all", t("all")], ["0-17", "0–17"], ["18-64", "18–64"], ["65-79", "65–79"], ["80+", "80+"]]} />],
    ["ward", <Sel key="w" label={t("ward")} value={String(f.ward)} onChange={(v) => up("ward", +v)} opts={[all, ...db.meta.wards.map((_, i) => [String(i), n.ward(i)] as [string, string])]} />],
    ["institution", <Sel key="i" label={t("institution")} value={f.institution} onChange={(v) => up("institution", v as Filters["institution"])} opts={[["all", t("all")], ["hospital", t("hospital")], ["primary_care", t("primary_care")]]} />],
    ["wardType", <Sel key="t" label={t("ward_type")} value={f.wardType} onChange={(v) => up("wardType", v as Filters["wardType"])} opts={[["all", t("all")], ["in", t("inpatient")], ["out", t("outpatient")]]} />],
    ["area", <Sel key="h" label={t("area")} value={f.area} onChange={(v) => up("area", v)} opts={[["all", t("all")], ...db.meta.areas.map((a) => [a, a] as [string, string])]} />],
    ["origin", <Sel key="g" label={t("origin")} value={f.origin} onChange={(v) => up("origin", v as Filters["origin"])} opts={[["all", t("all")], ["hai", t("hai")], ["community", t("community")]]} />],
  ];
  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
        {items.filter(([k]) => !hide.includes(k)).map(([, el]) => el)}
        <button onClick={() => set(defaultFilters)} className="h-9 self-end rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">{t("reset")}</button>
      </div>
    </div>
  );
}
