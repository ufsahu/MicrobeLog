import { useQuery } from "@tanstack/react-query";
import { loadUploads, mergeUploads, totalUploads } from "./upload";

export type Ward = { ward_code: string; ward_fi: string; ward_en: string; ward_type: "in" | "out"; institution: string };
export type Antibiotic = { antibiotic: string; antibiotic_code: string; antibiotic_fi: string; class: string; reported_for: string };
export type Meta = {
  areas: string[]; organisms: string[]; specimens: string[]; specimens_fi: string[]; results: string[];
  quantities: string[]; guidelines: string[]; wards: Ward[]; antibiotics: Antibiotic[];
};
export type RawDB = {
  meta: Meta;
  patients: [string, "F" | "M", number, number][];
  cultures: [string, number, number, string, number, number, number, string, number, number, number][];
  isolates: [string, number, number, number, number, number, string, number][];
  susceptibility: [number, string, string, number][]; // [isolate_idx, antibiotic_code, S/R, guideline_idx]
};

export type Patient = { idx: number; id: string; sex: "F" | "M"; birth: number; area: string };
export type Culture = {
  idx: number; id: string; p: number; age: number; date: string; t: number; year: number; week: number;
  ward: number; adm: string; spec: number; result: number; n: number; hai: boolean;
};
export type Isolate = {
  idx: number; id: string; c: number; no: number; org: number; qty: number; esbl: boolean; mrsa: boolean;
  vre: boolean; cpe: boolean; sus: string; guide: number;
  // denormalised for fast filtering
  p: number; sex: "F" | "M"; age: number; date: string; t: number; year: number; week: number; ward: number; spec: number; hai: boolean;
};
export type DB = { meta: Meta; patients: Patient[]; cultures: Culture[]; isolates: Isolate[]; maxT: number; minT: number;
  culturesByPatient: Map<number, number[]>; isolatesByCulture: Map<number, number[]> };

const DAY = 86400000;
export const toT = (d: string) => Date.parse(d + "T00:00:00Z");

function build(raw: RawDB): DB {
  const patients = raw.patients.map(([id, sex, birth, a], idx) => ({ idx, id, sex, birth, area: raw.meta.areas[a] }));
  let maxT = 0, minT = Infinity;
  const culturesByPatient = new Map<number, number[]>();
  const cultures = raw.cultures.map(([id, p, age, date, year, week, ward, adm, spec, result, n], idx) => {
    const t = toT(date);
    if (t > maxT) maxT = t;
    if (t < minT) minT = t;
    const hai = !!adm && (t - toT(adm)) / DAY >= 2; // sample on 3rd hospital day or later
    (culturesByPatient.get(p) ?? culturesByPatient.set(p, []).get(p)!).push(idx);
    return { idx, id, p, age, date, t, year, week, ward, adm, spec, result, n, hai };
  });
  const isolatesByCulture = new Map<number, number[]>();
  const isolates = raw.isolates.map(([id, c, no, org, qty, f, sus, guide], idx) => {
    const cu = cultures[c];
    (isolatesByCulture.get(c) ?? isolatesByCulture.set(c, []).get(c)!).push(idx);
    return {
      idx, id, c, no, org, qty, esbl: !!(f & 1), mrsa: !!(f & 2), vre: !!(f & 4), cpe: !!(f & 8), sus, guide,
      p: cu.p, sex: patients[cu.p].sex, age: cu.age, date: cu.date, t: cu.t, year: cu.year, week: cu.week, ward: cu.ward, spec: cu.spec, hai: cu.hai,
    };
  });
  // Bake susceptibility tuples (by isolate index + antibiotic code) into isolate sus strings.
  for (const [ii, code, res, g] of raw.susceptibility) {
    const a = raw.meta.antibiotics.findIndex((x) => x.antibiotic_code === code);
    if (a === -1 || !isolates[ii]) continue;
    const chars = isolates[ii].sus.split("");
    while (chars.length < raw.meta.antibiotics.length) chars.push(".");
    chars[a] = res;
    isolates[ii].sus = chars.join("");
    if (isolates[ii].guide === -1) isolates[ii].guide = g;
  }
  return { meta: raw.meta, patients, cultures, isolates, maxT, minT, culturesByPatient, isolatesByCulture };
}

/** Bumped whenever uploads change, so useDB refetches and re-merges. */
export let uploadRev = 0;
export function bumpUploadRev() { uploadRev++; }

export function useDB() {
  return useQuery({
    queryKey: ["microbelog-db", uploadRev],
    queryFn: async () => {
      const r = await fetch("/data/db.json");
      if (!r.ok) throw new Error("Failed to load data");
      let raw: RawDB = await r.json();
      if (!raw.susceptibility) raw.susceptibility = [];
      const up = loadUploads();
      if (totalUploads(up)) raw = mergeUploads(raw, up) ?? raw;
      return build(raw);
    },
    staleTime: Infinity,
    // Re-check for new data every 15 minutes so monitoring stays current
    refetchInterval: 15 * 60 * 1000,
  });
}

// ---------- Filters ----------
export type Filters = {
  org: number | -1; spec: number | -1; sex: "all" | "F" | "M"; ward: number | -1;
  institution: "all" | "hospital" | "primary_care"; wardType: "all" | "in" | "out";
  age: "all" | "0-17" | "18-64" | "65-79" | "80+"; area: string; origin: "all" | "hai" | "community";
};
export const defaultFilters: Filters = { org: -1, spec: -1, sex: "all", ward: -1, institution: "all", wardType: "all", age: "all", area: "all", origin: "all" };

export function ageGroup(a: number) { return a < 18 ? "0-17" : a < 65 ? "18-64" : a < 80 ? "65-79" : "80+"; }

export function applyFilters(db: DB, list: Isolate[], f: Filters) {
  return list.filter((i) => {
    if (f.org !== -1 && i.org !== f.org) return false;
    if (f.spec !== -1 && i.spec !== f.spec) return false;
    if (f.sex !== "all" && i.sex !== f.sex) return false;
    if (f.ward !== -1 && i.ward !== f.ward) return false;
    const w = db.meta.wards[i.ward];
    if (f.institution !== "all" && w.institution !== f.institution) return false;
    if (f.wardType !== "all" && w.ward_type !== f.wardType) return false;
    if (f.age !== "all" && ageGroup(i.age) !== f.age) return false;
    if (f.area !== "all" && db.patients[i.p].area !== f.area) return false;
    if (f.origin === "hai" && !i.hai) return false;
    if (f.origin === "community" && i.hai) return false;
    return true;
  });
}

// ---------- Surveillance rule ----------
export const MIN_ISOLATES = 30;

/** Keep only the first isolate per patient per species per specimen type per period. */
export function firstIsolates(list: Isolate[], period: (i: Isolate) => string | number = () => "all") {
  const sorted = [...list].sort((a, b) => a.t - b.t || a.no - b.no);
  const seen = new Set<string>();
  const out: Isolate[] = [];
  for (const i of sorted) {
    const k = `${i.p}|${i.org}|${i.spec}|${period(i)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

export type RRow = { code: string; ab: number; n: number; r: number; pct: number | null };

/** Resistance % per antibiotic. pct is null when fewer than 30 tested isolates. */
export function resistance(list: Isolate[], abCount: number): RRow[] {
  const n = new Array(abCount).fill(0), r = new Array(abCount).fill(0);
  for (const i of list) for (let k = 0; k < abCount; k++) {
    const c = i.sus.charCodeAt(k);
    if (c === 82) { n[k]++; r[k]++; } else if (c === 83) n[k]++;
  }
  return n.map((nn, k) => ({ code: "", ab: k, n: nn, r: r[k], pct: nn >= MIN_ISOLATES ? (100 * r[k]) / nn : null }));
}

export function resistanceFor(list: Isolate[], ab: number) {
  let n = 0, r = 0;
  for (const i of list) { const c = i.sus[ab]; if (c === "R") { n++; r++; } else if (c === "S") n++; }
  return { n, r, pct: n >= MIN_ISOLATES ? (100 * r) / n : null };
}

// ---------- Quantity zones ----------
export type Zone = "high" | "mid" | "low" | "none";
/** Urine (CFU/mL): >=10^5 significant (red), 10^4 borderline (yellow), 10^3 low (green).
 *  Wound semi-quantitative: +++ heavy (red), ++ moderate (yellow), + scant (green).
 *  Blood: any growth is clinically significant (red). */
export function quantityZone(q: string, spec: number): Zone {
  if (spec === 1) return "high";
  if (q === ">=10^5" || q === "+++") return "high";
  if (q === "10^4" || q === "++") return "mid";
  if (q === "10^3" || q === "+") return "low";
  return "none";
}
export function quantityLabel(q: string, spec: number) {
  if (spec === 1) return "growth";
  if (q.includes("10^")) return q.replace("10^", "10").replace(">=", "≥") + " CFU/mL";
  return q || "—";
}
export const zoneClass: Record<Zone, string> = {
  high: "bg-risk-high-soft text-risk-high border-risk-high/30",
  mid: "bg-risk-mid-soft text-foreground border-risk-mid/50",
  low: "bg-risk-low-soft text-risk-low border-risk-low/30",
  none: "bg-muted text-muted-foreground border-border",
};

export function pctZone(p: number | null): Zone {
  if (p === null) return "none";
  return p >= 20 ? "high" : p >= 10 ? "mid" : "low";
}

export const lastNDays = (db: DB, days: number) => (i: { t: number }) => i.t > db.maxT - days * DAY;
export const fmtPct = (p: number | null) => (p === null ? "n<30" : `${p.toFixed(1)}%`);

// ---------- CSV helper ----------
export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toCSV(rows: (string | number | null)[][]) {
  return rows.map((r) => r.map((v) => { const s = v === null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
}

// ---------- Linear trend ----------
export function linreg(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return { a: pts[0]?.y ?? 0, b: 0 };
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  const b = den ? num / den : 0;
  return { a: my - b * mx, b };
}
