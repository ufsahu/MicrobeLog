import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, FileUp, Trash2, UploadCloud } from "lucide-react";
import { PageHeader, Panel } from "@/components/AppShell";
import { useDB, bumpUploadRev, zoneClass, quantityLabel, toCSV, downloadText, type RawDB } from "@/lib/data";
import { patientRisk } from "@/lib/clinical";
import { useLang, names } from "@/lib/i18n";
import { seo } from "@/lib/seo";
import { KIND_COLS, detectKind, loadUploads, parseCSV, saveUploads, totalUploads, uploadCounts, uploadedOnly, type UploadKind, type UploadStore } from "@/lib/upload";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/upload")({
  head: () => seo("Upload New Data", "Upload new patient, culture, isolate and susceptibility CSV files and search them with the same filters as the Patients tab."),
  component: UploadPage,
});

const inputCls = "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
function Field({ label, col, children }: { label: string; col?: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>{label}{col && <span className="ml-1 font-mono text-[10px] opacity-70">{col}</span>}</span>{children}</label>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="mb-2 font-mono text-xs font-semibold text-primary">{title}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{children}</div></div>;
}

type F = {
  q: string; sex: string; birthMin: string; birthMax: string; area: string;
  ageMin: string; ageMax: string; dateFrom: string; dateTo: string; year: string; weekMin: string; weekMax: string;
  ward: string; wardType: string; institution: string; admitted: string; hai: string; specimen: string; result: string; nIso: string;
  organism: string; quantity: string; esbl: boolean; mrsa: boolean; vre: boolean; cpe: boolean;
  ab: string; abRes: string; guideline: string; risk: string; minCultures: string; sort: string;
};
const init: F = { q: "", sex: "", birthMin: "", birthMax: "", area: "", ageMin: "", ageMax: "", dateFrom: "", dateTo: "", year: "", weekMin: "", weekMax: "",
  ward: "", wardType: "", institution: "", admitted: "", hai: "", specimen: "", result: "", nIso: "", organism: "", quantity: "",
  esbl: false, mrsa: false, vre: false, cpe: false, ab: "", abRes: "", guideline: "", risk: "", minCultures: "", sort: "risk" };

function UploadPage() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const fi = lang === "fi";
  const [store, setStore] = useState<UploadStore>(() => loadUploads());
  const [msg, setMsg] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (next: UploadStore, note: string) => {
    saveUploads(next);
    setStore({ ...next });
    bumpUploadRev();
    qc.invalidateQueries({ queryKey: ["microbelog-db"] });
    setMsg(note);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const next = { ...store };
    let added = 0, skipped: string[] = [];
    for (const file of Array.from(files)) {
      const rows = parseCSV(await file.text());
      if (rows.length < 2) { skipped.push(file.name); continue; }
      const kind = detectKind(rows[0]);
      if (!kind) { skipped.push(file.name); continue; }
      const body = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
      next[kind] = [...(next[kind] ?? []), ...body];
      added += body.length;
    }
    if (added) apply(next, fi ? `Lisätty ${added} riviä.${skipped.length ? ` Ohitettu: ${skipped.join(", ")}` : ""}` : `Added ${added} rows.${skipped.length ? ` Skipped: ${skipped.join(", ")}` : ""}`);
    else setMsg(fi ? `Ei tunnistettuja rivejä${skipped.length ? ` (ohitettu: ${skipped.join(", ")})` : ""}. Tarkista sarakeotsikot.` : `No recognised rows${skipped.length ? ` (skipped: ${skipped.join(", ")})` : ""}. Check the column headers.`);
  };

  const clearKind = (k: UploadKind) => { const next = { ...store, [k]: [] }; apply(next, fi ? "Tyhjennetty." : "Cleared."); };
  const clearAll = () => apply({}, fi ? "Kaikki ladatut tiedot poistettu." : "All uploaded data removed.");

  // Build a DB containing only the uploaded rows, for the search below.
  const upDB = useMemo(() => {
    if (!db || !totalUploads(store)) return null;
    const empty: RawDB = { meta: db.meta, patients: [], cultures: [], isolates: [], susceptibility: [] };
    const raw = uploadedOnly(empty, store);
    if (!raw) return null;
    // Reuse the same builder as the main dataset via a synthetic fetch-free path:
    return buildLite(raw);
  }, [db, store]);

  if (!db) return null;
  const counts = uploadCounts(store);
  const total = totalUploads(store);

  return (
    <>
      <PageHeader title={t("upload")} sub={fi
        ? "Lataa uusia CSV-tiedostoja (potilaat, näytteet, isolaatit, herkkyystiedot). Tiedot yhdistetään kaikkiin välilehtiin ja voit hakea niistä alla samoilla suodattimilla kuin Potilaat-välilehdellä."
        : "Upload new CSV files (patients, cultures, isolates, susceptibility). The rows merge into every tab, and you can search them below with the same filters as the Patients tab."} />

      <Panel title={fi ? "Lataa tiedostoja" : "Upload files"} className="mb-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-primary bg-secondary" : "border-border hover:bg-muted/50"}`}
        >
          <UploadCloud className="h-8 w-8 text-primary" />
          <p className="text-sm font-medium">{fi ? "Raahaa CSV-tiedostoja tähän tai valitse tiedosto" : "Drag CSV files here or click to choose files"}</p>
          <p className="text-xs text-muted-foreground">{fi ? "Tiedostotyyppi tunnistetaan sarakeotsikoista automaattisesti" : "The dataset type is detected automatically from the column headers"}</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {counts.map(({ kind, n }) => (
            <div key={kind} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-xs font-semibold text-primary">{kind}</span>
                {n > 0 && <button onClick={() => clearKind(kind)} aria-label={`clear ${kind}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="mt-1 font-display text-xl font-semibold">{n.toLocaleString()}</div>
              <div className="truncate text-[10px] text-muted-foreground">{KIND_COLS[kind].join(", ")}</div>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{fi ? "Ladatut rivit näkyvät kaikissa välilehdissä (Yleiskatsaus, Resistenssi, Seuranta, Potilaat…) ja säilyvät tässä selaimessa." : "Uploaded rows appear in every tab (Overview, Resistance, Monitoring, Patients…) and persist in this browser."}</p>
            <button onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />{fi ? "Poista kaikki ladatut" : "Remove all uploaded"}</button>
          </div>
        )}
      </Panel>

      {upDB ? <UploadedSearch db={upDB} fi={fi} /> : (
        <Panel className="text-center text-sm text-muted-foreground">
          <FileUp className="mx-auto mb-2 h-6 w-6 text-primary" />
          {fi ? "Lataa tiedostoja nähdäksesi haun ja tulokset täällä." : "Upload files to see the search and results here."}
        </Panel>
      )}
    </>
  );
}

/** Minimal DB builder for the uploaded-only subset (mirrors build() in data.ts). */
function buildLite(raw: RawDB) {
  const DAY = 86400000;
  const toT = (d: string) => Date.parse(d + "T00:00:00Z");
  const patients = raw.patients.map(([id, sex, birth, a], idx) => ({ idx, id, sex, birth, area: raw.meta.areas[a] }));
  let maxT = 0, minT = Infinity;
  const culturesByPatient = new Map<number, number[]>();
  const cultures = raw.cultures.map(([id, p, age, date, year, week, ward, adm, spec, result, n], idx) => {
    const t = toT(date);
    if (t > maxT) maxT = t;
    if (t < minT) minT = t;
    const hai = !!adm && (t - toT(adm)) / DAY >= 2;
    (culturesByPatient.get(p) ?? culturesByPatient.set(p, []).get(p)!).push(idx);
    return { idx, id, p, age, date, t, year, week, ward, adm, spec, result, n, hai };
  });
  const isolatesByCulture = new Map<number, number[]>();
  const isolates = raw.isolates.map(([id, c, no, org, qty, f, sus, guide], idx) => {
    const cu = cultures[c];
    (isolatesByCulture.get(c) ?? isolatesByCulture.set(c, []).get(c)!).push(idx);
    return { idx, id, c, no, org, qty, esbl: !!(f & 1), mrsa: !!(f & 2), vre: !!(f & 4), cpe: !!(f & 8), sus, guide,
      p: cu.p, sex: patients[cu.p].sex, age: cu.age, date: cu.date, t: cu.t, year: cu.year, week: cu.week, ward: cu.ward, spec: cu.spec, hai: cu.hai };
  });
  return { meta: raw.meta, patients, cultures, isolates, maxT, minT, culturesByPatient, isolatesByCulture };
}

/** Patients-tab-style search scoped to the uploaded rows only. */
function UploadedSearch({ db, fi }: { db: ReturnType<typeof buildLite>; fi: boolean }) {
  const { t, lang } = useLang();
  const [f, setF] = useState<F>(init);
  const [limit, setLimit] = useState(50);
  const up = <K extends keyof F>(k: K, v: F[K]) => { setF((p) => ({ ...p, [k]: v })); setLimit(50); };
  const n = names(db as never, lang);

  const res = useMemo(() => {
    const ql = f.q.trim().toLowerCase();
    const num = (s: string) => (s === "" ? null : +s);
    const [bMin, bMax, aMin, aMax, wMin, wMax, minC] = [f.birthMin, f.birthMax, f.ageMin, f.ageMax, f.weekMin, f.weekMax, f.minCultures].map(num);
    const cultureFilterOn = !!(f.ageMin || f.ageMax || f.dateFrom || f.dateTo || f.year || f.weekMin || f.weekMax || f.ward || f.wardType || f.institution || f.admitted || f.hai || f.specimen || f.result || f.nIso);
    const isoFilterOn = !!(f.organism || f.quantity || f.esbl || f.mrsa || f.vre || f.cpe || f.ab || f.guideline);
    const out: { p: (typeof db.patients)[number]; r: ReturnType<typeof patientRisk>; hits: number; last: string }[] = [];
    for (const p of db.patients) {
      if (f.sex && p.sex !== f.sex) continue;
      if (f.area && p.area !== f.area) continue;
      if (bMin !== null && p.birth < bMin) continue;
      if (bMax !== null && p.birth > bMax) continue;
      const cIdx = db.culturesByPatient.get(p.idx) ?? [];
      if (minC !== null && cIdx.length < minC) continue;
      const matchedCultures = cIdx.map((i) => db.cultures[i]).filter((c) => {
        const w = db.meta.wards[c.ward];
        if (aMin !== null && c.age < aMin) return false;
        if (aMax !== null && c.age > aMax) return false;
        if (f.dateFrom && c.date < f.dateFrom) return false;
        if (f.dateTo && c.date > f.dateTo) return false;
        if (f.year && c.year !== +f.year) return false;
        if (wMin !== null && c.week < wMin) return false;
        if (wMax !== null && c.week > wMax) return false;
        if (f.ward && String(c.ward) !== f.ward) return false;
        if (f.wardType && w.ward_type !== f.wardType) return false;
        if (f.institution && w.institution !== f.institution) return false;
        if (f.admitted === "yes" && !c.adm) return false;
        if (f.admitted === "no" && c.adm) return false;
        if (f.hai === "yes" && !c.hai) return false;
        if (f.hai === "no" && c.hai) return false;
        if (f.specimen && String(c.spec) !== f.specimen) return false;
        if (f.result && String(c.result) !== f.result) return false;
        if (f.nIso && String(c.n) !== f.nIso) return false;
        if (isoFilterOn) {
          const isos = (db.isolatesByCulture.get(c.idx) ?? []).map((i) => db.isolates[i]).filter((i) => {
            if (f.organism && String(i.org) !== f.organism) return false;
            if (f.quantity && String(i.qty) !== f.quantity) return false;
            if (f.esbl && !i.esbl) return false;
            if (f.mrsa && !i.mrsa) return false;
            if (f.vre && !i.vre) return false;
            if (f.cpe && !i.cpe) return false;
            if (f.guideline && String(i.guide) !== f.guideline) return false;
            if (f.ab) { const s = i.sus[+f.ab]; if (!s || s === ".") return false; if (f.abRes && s !== f.abRes) return false; }
            return true;
          });
          if (!isos.length) return false;
        }
        return true;
      });
      if ((cultureFilterOn || isoFilterOn) && !matchedCultures.length) continue;
      if (ql) {
        const hay = [p.id, p.area, p.sex, p.birth, ...cIdx.map((i) => db.cultures[i].id),
          ...cIdx.flatMap((i) => (db.isolatesByCulture.get(i) ?? []).flatMap((k) => [db.isolates[k].id, db.meta.organisms[db.isolates[k].org]]))].join(" ").toLowerCase();
        if (!hay.includes(ql)) continue;
      }
      const r = patientRisk(db as never, p as never);
      if (f.risk && r.level !== f.risk) continue;
      const last = cIdx.length ? db.cultures[cIdx[cIdx.length - 1]].date : "";
      out.push({ p, r, hits: matchedCultures.length, last });
    }
    const s = f.sort;
    out.sort((a, b) => s === "id" ? a.p.id.localeCompare(b.p.id) : s === "cultures" ? b.r.cultures.length - a.r.cultures.length : s === "recent" ? b.last.localeCompare(a.last) : s === "birth" ? a.p.birth - b.p.birth : b.r.score - a.r.score);
    return out;
  }, [db, f]);

  const active = Object.entries(f).filter(([k, v]) => k !== "sort" && v !== "" && v !== false).length;
  const years = [...new Set(db.cultures.map((c) => c.year))].sort();
  const exportCsv = () => downloadText("microbelog_uploaded_search.csv", toCSV([["patient_id", "sex", "birth_year", "home_area", "n_cultures", "matching_cultures", "last_sample", "risk_score", "risk_reasons"],
    ...res.map(({ p, r, hits, last }) => [p.id, p.sex, p.birth, p.area, r.cultures.length, hits, last, r.score, r.reasons.join(" ")])]));

  return (
    <>
      <h2 className="mb-2 text-lg font-semibold">{fi ? "Hae ladatuista tiedoista" : "Search uploaded data"}</h2>
      <div className="mb-3 flex gap-2">
        <input value={f.q} onChange={(e) => up("q", e.target.value)} placeholder={fi ? "Potilas-, näyte- tai isolaattitunnus, mikrobi, alue…" : "Patient, culture or isolate ID, organism, area…"} className="h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm" />
      </div>

      <div className="mb-4 space-y-4 rounded-xl border border-border bg-card p-4 shadow-card">
        <Group title={fi ? "Potilaat" : "Patients"}>
          <Field label={t("sex")} col="sex"><select className={inputCls} value={f.sex} onChange={(e) => up("sex", e.target.value)}><option value="">{t("all")}</option><option value="F">{t("female")}</option><option value="M">{t("male")}</option></select></Field>
          <Field label={fi ? "Syntymävuosi alkaen" : "Born from"} col="birth_year"><input type="number" className={inputCls} value={f.birthMin} onChange={(e) => up("birthMin", e.target.value)} placeholder="1920" /></Field>
          <Field label={fi ? "Syntymävuosi asti" : "Born to"} col="birth_year"><input type="number" className={inputCls} value={f.birthMax} onChange={(e) => up("birthMax", e.target.value)} placeholder="2026" /></Field>
          <Field label={t("area")} col="home_area"><select className={inputCls} value={f.area} onChange={(e) => up("area", e.target.value)}><option value="">{t("all")}</option>{db.meta.areas.map((a) => <option key={a}>{a}</option>)}</select></Field>
          <Field label={fi ? "Viljelyjä vähintään" : "Min. cultures"}><input type="number" min={1} className={inputCls} value={f.minCultures} onChange={(e) => up("minCultures", e.target.value)} /></Field>
          <Field label={t("risk")}><select className={inputCls} value={f.risk} onChange={(e) => up("risk", e.target.value)}><option value="">{t("all")}</option><option value="high">{t("high")}</option><option value="mid">{t("mid")}</option><option value="low">{t("low")}</option></select></Field>
        </Group>
        <Group title={fi ? "Näytteet" : "Cultures"}>
          <Field label={fi ? "Ikä alkaen" : "Age from"} col="age_years"><input type="number" className={inputCls} value={f.ageMin} onChange={(e) => up("ageMin", e.target.value)} /></Field>
          <Field label={fi ? "Ikä asti" : "Age to"} col="age_years"><input type="number" className={inputCls} value={f.ageMax} onChange={(e) => up("ageMax", e.target.value)} /></Field>
          <Field label={fi ? "Näytepäivä alkaen" : "Sample from"} col="sample_date"><input type="date" className={inputCls} value={f.dateFrom} onChange={(e) => up("dateFrom", e.target.value)} /></Field>
          <Field label={fi ? "Näytepäivä asti" : "Sample to"} col="sample_date"><input type="date" className={inputCls} value={f.dateTo} onChange={(e) => up("dateTo", e.target.value)} /></Field>
          <Field label={fi ? "Vuosi" : "Year"} col="iso_year"><select className={inputCls} value={f.year} onChange={(e) => up("year", e.target.value)}><option value="">{t("all")}</option>{years.map((y) => <option key={y}>{y}</option>)}</select></Field>
          <Field label={fi ? "Viikko alkaen" : "Week from"} col="iso_week"><input type="number" min={1} max={53} className={inputCls} value={f.weekMin} onChange={(e) => up("weekMin", e.target.value)} /></Field>
          <Field label={fi ? "Viikko asti" : "Week to"} col="iso_week"><input type="number" min={1} max={53} className={inputCls} value={f.weekMax} onChange={(e) => up("weekMax", e.target.value)} /></Field>
          <Field label={t("ward")} col="ward_code"><select className={inputCls} value={f.ward} onChange={(e) => up("ward", e.target.value)}><option value="">{t("all")}</option>{db.meta.wards.map((w, i) => <option key={w.ward_code} value={i}>{w.ward_code} · {n.ward(i)}</option>)}</select></Field>
          <Field label={t("ward_type")} col="ward_type"><select className={inputCls} value={f.wardType} onChange={(e) => up("wardType", e.target.value)}><option value="">{t("all")}</option><option value="in">{t("inpatient")}</option><option value="out">{t("outpatient")}</option></select></Field>
          <Field label={t("institution")} col="institution"><select className={inputCls} value={f.institution} onChange={(e) => up("institution", e.target.value)}><option value="">{t("all")}</option><option value="hospital">{t("hospital")}</option><option value="primary_care">{t("primary_care")}</option></select></Field>
          <Field label={fi ? "Sisäänotettu" : "Admitted"} col="admission_date"><select className={inputCls} value={f.admitted} onChange={(e) => up("admitted", e.target.value)}><option value="">{t("all")}</option><option value="yes">{fi ? "Kyllä" : "Yes"}</option><option value="no">{fi ? "Ei" : "No"}</option></select></Field>
          <Field label={t("origin")}><select className={inputCls} value={f.hai} onChange={(e) => up("hai", e.target.value)}><option value="">{t("all")}</option><option value="yes">{t("hai")}</option><option value="no">{t("community")}</option></select></Field>
          <Field label={t("specimen")} col="specimen / specimen_fi"><select className={inputCls} value={f.specimen} onChange={(e) => up("specimen", e.target.value)}><option value="">{t("all")}</option>{db.meta.specimens.map((_, i) => <option key={i} value={i}>{n.spec(i)}</option>)}</select></Field>
          <Field label={fi ? "Tulos" : "Result"} col="result"><select className={inputCls} value={f.result} onChange={(e) => up("result", e.target.value)}><option value="">{t("all")}</option>{db.meta.results.map((_, i) => <option key={i} value={i}>{n.result(i)}</option>)}</select></Field>
          <Field label={fi ? "Isolaatteja" : "Isolates"} col="n_isolates"><select className={inputCls} value={f.nIso} onChange={(e) => up("nIso", e.target.value)}><option value="">{t("all")}</option>{[0, 1, 2].map((x) => <option key={x}>{x}</option>)}</select></Field>
        </Group>
        <Group title={fi ? "Isolaatit" : "Isolates"}>
          <Field label={t("organism")} col="organism"><select className={inputCls} value={f.organism} onChange={(e) => up("organism", e.target.value)}><option value="">{t("all")}</option>{db.meta.organisms.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></Field>
          <Field label={t("quantity")} col="quantity"><select className={inputCls} value={f.quantity} onChange={(e) => up("quantity", e.target.value)}><option value="">{t("all")}</option>{db.meta.quantities.map((q, i) => q && <option key={q} value={i}>{quantityLabel(q, 0)}</option>)}</select></Field>
          <Field label={t("phenotypes")} col="esbl · mrsa · vre · cpe">
            <div className="flex h-9 flex-wrap items-center gap-1">{(["esbl", "mrsa", "vre", "cpe"] as const).map((k) => (
              <button key={k} onClick={() => up(k, !f[k])} className={`rounded-md border px-2 py-1 text-xs font-bold uppercase ${f[k] ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-foreground"}`}>{k}</button>))}</div>
          </Field>
        </Group>
        <Group title={fi ? "Herkkyystiedot · antibiootit" : "Susceptibility · antibiotics"}>
          <Field label={t("antibiotic")} col="antibiotic / antibiotic_code / antibiotic_fi"><select className={inputCls} value={f.ab} onChange={(e) => up("ab", e.target.value)}><option value="">{t("all")}</option>{db.meta.antibiotics.map((a, i) => <option key={a.antibiotic_code} value={i}>{a.antibiotic_code} · {n.ab(i)} ({a.class}{a.reported_for === "urine" ? ", " + n.spec(0) : ""})</option>)}</select></Field>
          <Field label={fi ? "Herkkyystulos" : "S/R result"} col="result"><select className={inputCls} value={f.abRes} disabled={!f.ab} onChange={(e) => up("abRes", e.target.value)}><option value="">{fi ? "Testattu" : "Tested"}</option><option value="R">R · {t("resistant")}</option><option value="S">S · {t("susceptible")}</option></select></Field>
          <Field label={fi ? "Tulkintaohje" : "Guideline"} col="guideline"><select className={inputCls} value={f.guideline} onChange={(e) => up("guideline", e.target.value)}><option value="">{t("all")}</option>{db.meta.guidelines.map((g, i) => <option key={g} value={i}>{g}</option>)}</select></Field>
        </Group>
        <div className="flex justify-end"><button onClick={() => setF(init)} className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted">{t("reset")}</button></div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{res.length.toLocaleString()} {fi ? "potilasta" : "patients"}</span>
        <div className="flex items-center gap-2">
          <select className="h-8 rounded-lg border border-input bg-card px-2 text-sm" value={f.sort} onChange={(e) => up("sort", e.target.value)}>
            <option value="risk">{fi ? "Riski" : "Risk"} ↓</option><option value="recent">{fi ? "Viimeisin näyte" : "Latest sample"} ↓</option>
            <option value="cultures">{t("cultures_n")} ↓</option><option value="birth">birth_year ↑</option><option value="id">patient_id</option>
          </select>
          <button onClick={exportCsv} className="h-8 rounded-lg border border-border bg-card px-3 text-sm">CSV ↓</button>
        </div>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {res.slice(0, limit).map(({ p, r, hits, last }) => (
          <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground">{p.sex}</div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm font-semibold">{p.id}</div>
              <div className="truncate text-xs text-muted-foreground">{p.birth} · {p.area} · {r.cultures.length} {t("cultures_n").toLowerCase()}{active ? ` (${hits} ${fi ? "osumaa" : "match"})` : ""} · {last} · {r.reasons.join(", ")}</div>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${zoneClass[r.level]}`}>{r.score}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        {!res.length && <p className="p-6 text-center text-sm text-muted-foreground">{fi ? "Ei tuloksia" : "No matches"}</p>}
      </div>
      {res.length > limit && <button onClick={() => setLimit(limit + 50)} className="mt-3 w-full rounded-lg border border-border bg-card py-2 text-sm font-medium">{fi ? "Näytä lisää" : "Show more"} ({res.length - limit})</button>}
    </>
  );
}
