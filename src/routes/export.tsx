import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, ExternalLink, FileCode2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { useDB, applyFilters, defaultFilters, type Filters, firstIsolates, resistance, downloadText, toCSV } from "@/lib/data";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";
import susAsset from "@/assets/susceptibility.csv.asset.json";

export const Route = createFileRoute("/export")({
  head: () => seo("Export & R", "Download raw CSV datasets and computed resistance statistics, with a ready-made R script and in-browser R."),
  component: ExportPage,
});

const R_SCRIPT = `# MicrobeLog – first-isolate resistance analysis in R
library(dplyr); library(ggplot2)
cultures <- read.csv("cultures.csv"); isolates <- read.csv("isolates.csv")
sus <- read.csv("susceptibility.csv"); patients <- read.csv("patients.csv")

df <- sus |>
  inner_join(isolates |> select(isolate_id, isolate_no), by = "isolate_id") |>
  inner_join(cultures |> select(culture_id, patient_id, sample_date, iso_year, specimen), by = "culture_id") |>
  inner_join(patients |> select(patient_id, sex), by = "patient_id")

# First isolate per patient per species per specimen type per year
first <- isolates |>
  inner_join(cultures, by = "culture_id") |>
  arrange(sample_date, isolate_no) |>
  distinct(patient_id, organism, specimen, iso_year, .keep_all = TRUE) |>
  pull(isolate_id)

res <- df |> filter(isolate_id %in% first) |>
  group_by(iso_year, specimen, organism, antibiotic, sex) |>
  summarise(n = n(), R = sum(result == "R"), .groups = "drop") |>
  mutate(pct_R = ifelse(n >= 30, 100 * R / n, NA))   # report only with >= 30 isolates

print(res |> filter(organism == "Escherichia coli", specimen == "urine"))

ggplot(res |> filter(organism == "Escherichia coli", specimen == "urine", !is.na(pct_R)),
       aes(factor(iso_year), pct_R, fill = sex)) + geom_col(position = "dodge") +
  facet_wrap(~antibiotic) + labs(x = "Year", y = "% resistant", title = "Urinary E. coli")
`;

function ExportPage() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const [f, setF] = useState<Filters>(defaultFilters);
  if (!db) return null;
  const n = names(db, lang);
  const files = [["cultures.csv", "/data/csv/cultures.csv"], ["isolates.csv", "/data/csv/isolates.csv"], ["susceptibility.csv", susAsset.url], ["patients.csv", "/data/csv/patients.csv"], ["wards.csv", "/data/csv/wards.csv"], ["antibiotics.csv", "/data/csv/antibiotics.csv"]];

  const exportStats = () => {
    const base = applyFilters(db, db.isolates, f);
    const rows: (string | number | null)[][] = [["iso_year", "organism", "specimen", "antibiotic", "antibiotic_code", "antibiotic_fi", "n_first_isolates", "n_R", "n_S", "pct_R"]];
    for (const y of [2023, 2024, 2025, 2026]) for (let o = 0; o < db.meta.organisms.length; o++) for (let s = 0; s < 3; s++) {
      const l = firstIsolates(base.filter((i) => i.year === y && i.org === o && i.spec === s), (i) => i.year);
      if (!l.length) continue;
      resistance(l, db.meta.antibiotics.length).filter((r) => r.n).forEach((r) => { const a = db.meta.antibiotics[r.ab];
        rows.push([y, db.meta.organisms[o], db.meta.specimens[s], a.antibiotic, a.antibiotic_code, a.antibiotic_fi, r.n, r.r, r.n - r.r, r.pct === null ? null : +r.pct.toFixed(2)]); });
    }
    downloadText("microbelog_resistance_first_isolates.csv", toCSV(rows));
  };
  const exportQuantity = () => {
    const base = applyFilters(db, db.isolates, f);
    const c: Record<string, number> = {}; base.forEach((i) => { const k = `${db.meta.specimens[i.spec]}|${db.meta.quantities[i.qty]}`; c[k] = (c[k] ?? 0) + 1; });
    const rows: (string | number)[][] = [["specimen", "quantity", "n", "pct_of_specimen"]];
    Object.entries(c).forEach(([k, v]) => { const [s, q] = k.split("|"); const tot = base.filter((i) => db.meta.specimens[i.spec] === s).length; rows.push([s, q || "(none)", v, +((100 * v) / tot).toFixed(2)]); });
    downloadText("microbelog_quantity_distribution.csv", toCSV(rows));
  };

  return (
    <>
      <PageHeader title={t("export")} sub={lang === "en" ? "Standard CSV (comma, UTF-8, ISO dates). Finnish Excel: Data → From Text/CSV." : "Standardi-CSV (pilkku, UTF-8, ISO-päivämäärät). Suomenkielinen Excel: Tiedot → Tekstistä/CSV:stä."} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={lang === "en" ? "Raw datasets" : "Raaka-aineistot"}>
          <div className="grid grid-cols-2 gap-2">{files.map(([name, href]) => (
            <a key={name} href={href} download={name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary"><Download className="h-4 w-4 text-accent" /><span className="font-mono">{name}</span></a>))}</div>
        </Panel>
        <Panel title={lang === "en" ? "R extension" : "R-laajennus"}>
          <p className="text-sm text-muted-foreground">{lang === "en" ? "Ready-made script applying the first-isolate and n ≥ 30 rules with dplyr + ggplot2. Run locally in RStudio or in your browser with webR." : "Valmis skripti, joka soveltaa ensimmäisen isolaatin ja n ≥ 30 -sääntöjä. Aja RStudiossa tai selaimessa webR:llä."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => downloadText("microbelog_analysis.R", R_SCRIPT, "text/plain")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><FileCode2 className="h-4 w-4" />microbelog_analysis.R</button>
            <a href="https://webr.r-wasm.org/latest/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">webR <ExternalLink className="h-4 w-4" /></a>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-sidebar p-3 text-xs text-sidebar-foreground">{R_SCRIPT}</pre>
        </Panel>
      </div>
      <h2 className="mb-2 mt-6 text-lg font-semibold">{lang === "en" ? "Computed statistics (uses filters)" : "Lasketut tilastot (rajausten mukaan)"}</h2>
      <FilterBar db={db} f={f} set={setF} hide={["org", "spec"]} />
      <div className="flex flex-wrap gap-2">
        <button onClick={exportStats} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"><Download className="h-4 w-4" />{lang === "en" ? "Resistance by year × organism × specimen" : "Resistenssi vuosi × mikrobi × näyte"}</button>
        <button onClick={exportQuantity} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold"><Download className="h-4 w-4" />{lang === "en" ? "Quantity distribution %" : "Määrien jakauma %"}</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{n.ab(0)} … {n.ab(12)}</p>
    </>
  );
}
