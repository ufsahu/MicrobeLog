import type { DB, RawDB } from "./data";

export type UploadKind = "patients" | "cultures" | "isolates" | "susceptibility";

/** Stored shape: raw CSV cell rows (header stripped) per dataset kind. */
export type UploadStore = Partial<Record<UploadKind, string[][]>>;
export const UPLOAD_KEY = "microbelog-upload";

export const KIND_COLS: Record<UploadKind, string[]> = {
  patients: ["patient_id", "sex", "birth_year", "home_area"],
  cultures: ["culture_id", "patient_id", "age_years", "sample_date", "iso_year", "iso_week", "ward_code", "ward_fi", "ward_en", "ward_type", "institution", "admission_date", "specimen", "specimen_fi", "result", "n_isolates"],
  isolates: ["isolate_id", "culture_id", "isolate_no", "organism", "quantity", "esbl", "mrsa", "vre", "cpe"],
  susceptibility: ["isolate_id", "culture_id", "organism", "antibiotic", "antibiotic_code", "antibiotic_fi", "result", "guideline"],
};

/** Minimal CSV parser: quoted fields, escaped quotes, LF/CRLF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Detect which dataset a CSV belongs to from its header row. */
export function detectKind(header: string[]): UploadKind | null {
  const h = header.map((s) => s.trim().toLowerCase());
  const has = (...cols: string[]) => cols.every((c) => h.includes(c));
  if (has("patient_id", "sex", "birth_year")) return "patients";
  if (has("culture_id", "patient_id", "sample_date", "specimen")) return "cultures";
  if (has("isolate_id", "culture_id", "organism", "quantity")) return "isolates";
  if (has("isolate_id", "antibiotic", "result")) return "susceptibility";
  return null;
}

export function loadUploads(): UploadStore {
  try {
    const s = localStorage.getItem(UPLOAD_KEY);
    return s ? (JSON.parse(s) as UploadStore) : {};
  } catch { return {}; }
}
export function saveUploads(u: UploadStore) {
  if (Object.values(u).every((r) => !r || !r.length)) localStorage.removeItem(UPLOAD_KEY);
  else localStorage.setItem(UPLOAD_KEY, JSON.stringify(u));
}
export function uploadCounts(u: UploadStore) {
  return (Object.keys(KIND_COLS) as UploadKind[]).map((k) => ({ kind: k, n: u[k]?.length ?? 0 }));
}
export function totalUploads(u: UploadStore) { return uploadCounts(u).reduce((s, x) => s + x.n, 0); }

/** Merge uploaded CSV rows into the packed db.json structure. Returns null when nothing valid to add. */
export function mergeUploads(raw: RawDB, up: UploadStore): RawDB | null {
  if (!totalUploads(up)) return null;
  const meta: RawDB["meta"] = {
    ...raw.meta,
    areas: [...raw.meta.areas], organisms: [...raw.meta.organisms], specimens: [...raw.meta.specimens],
    specimens_fi: [...raw.meta.specimens_fi], results: [...raw.meta.results], quantities: [...raw.meta.quantities],
    guidelines: [...raw.meta.guidelines], wards: raw.meta.wards.map((w) => ({ ...w })),
    antibiotics: raw.meta.antibiotics.map((a) => ({ ...a })),
  };
  const idx = <T>(arr: T[], v: T): number => { let i = arr.indexOf(v); if (i === -1) { arr.push(v); i = arr.length - 1; } return i; };
  const out: RawDB = {
    meta,
    patients: raw.patients.map((p) => [...p] as RawDB["patients"][number]),
    cultures: raw.cultures.map((c) => [...c] as RawDB["cultures"][number]),
    isolates: raw.isolates.map((i) => [...i] as RawDB["isolates"][number]),
    susceptibility: raw.susceptibility.map((s) => [...s] as RawDB["susceptibility"][number]),
  };
  const errors: string[] = [];

  // 1) patients
  const pIdx = new Map(out.patients.map((p, i) => [p[0], i]));
  for (const r of up.patients ?? []) {
    const [id, sex, birth, area] = r.map((s) => s.trim());
    if (!id || (sex !== "F" && sex !== "M") || !/^\d{4}$/.test(birth)) { errors.push(`patients: ${id || "?"}`); continue; }
    if (pIdx.has(id)) continue;
    pIdx.set(id, out.patients.length);
    out.patients.push([id, sex, +birth, idx(meta.areas, area || "Unknown")]);
  }
  // 2) cultures
  const cIdx = new Map(out.cultures.map((c, i) => [c[0], i]));
  for (const r of up.cultures ?? []) {
    const [id, pid, age, date, year, week, wardCode, wardFi, wardEn, wardType, inst, adm, spec, specFi, result, nIso] = r.map((s) => s.trim());
    const p = pIdx.get(pid);
    if (!id || p === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`cultures: ${id || "?"}`); continue; }
    if (cIdx.has(id)) continue;
    let w = meta.wards.findIndex((x) => x.ward_code === wardCode);
    if (w === -1) { meta.wards.push({ ward_code: wardCode || "UNK", ward_fi: wardFi || wardCode || "UNK", ward_en: wardEn || wardCode || "UNK", ward_type: wardType === "in" ? "in" : "out", institution: inst || "hospital" }); w = meta.wards.length - 1; }
    let si = meta.specimens.indexOf(spec);
    if (si === -1) { meta.specimens.push(spec || "other"); meta.specimens_fi.push(specFi || spec || "muu"); si = meta.specimens.length - 1; }
    const y = +year || +date.slice(0, 4);
    cIdx.set(id, out.cultures.length);
    out.cultures.push([id, p, +age || 0, date, y, +week || 1, w, adm, si, idx(meta.results, result || "positive"), +nIso || 0]);
  }
  // 3) isolates
  const iIdx = new Map(out.isolates.map((i, k) => [i[0], k]));
  const iSus = new Map<string, { sus: string[]; guide: number }>();
  for (const r of up.isolates ?? []) {
    const [id, cid, no, org, qty, esbl, mrsa, vre, cpe] = r.map((s) => s.trim());
    const c = cIdx.get(cid);
    if (!id || c === undefined) { errors.push(`isolates: ${id || "?"}`); continue; }
    if (iIdx.has(id)) continue;
    let flags = 0;
    if (/^(1|true|yes|kyllä)$/i.test(esbl)) flags |= 1;
    if (/^(1|true|yes|kyllä)$/i.test(mrsa)) flags |= 2;
    if (/^(1|true|yes|kyllä)$/i.test(vre)) flags |= 4;
    if (/^(1|true|yes|kyllä)$/i.test(cpe)) flags |= 8;
    iIdx.set(id, out.isolates.length);
    iSus.set(id, { sus: [], guide: -1 });
    out.isolates.push([id, c, +no || 1, idx(meta.organisms, org || "Unknown"), idx(meta.quantities, qty), flags, "", -1]);
  }
  // 4) susceptibility rows
  for (const r of up.susceptibility ?? []) {
    const [iid, cid, org, ab, code, abFi, res, guide] = r.map((s) => s.trim());
    const ii = iIdx.get(iid);
    if (!iid || ii === undefined || (res !== "S" && res !== "R")) { errors.push(`susceptibility: ${iid || "?"}`); continue; }
    let a = meta.antibiotics.findIndex((x) => x.antibiotic_code === code || x.antibiotic === ab);
    if (a === -1) { meta.antibiotics.push({ antibiotic: ab || code, antibiotic_code: code || ab, antibiotic_fi: abFi || ab || code, class: "other", reported_for: "all" }); a = meta.antibiotics.length - 1; }
    const g = idx(meta.guidelines, guide || meta.guidelines[0]);
    out.susceptibility.push([ii, code || ab, res, g]);
    const st = iSus.get(iid);
    if (st) { st.sus[a] = res; st.guide = g; }
  }
  // bake sus strings into new isolates
  for (const [id, st] of iSus) {
    const k = iIdx.get(id)!;
    out.isolates[k][6] = meta.antibiotics.map((_, a) => st.sus[a] ?? ".").join("");
    out.isolates[k][7] = st.guide;
  }
  if (errors.length) console.warn("Upload: skipped rows", errors);
  return out;
}

/** Build a DB-shaped object containing ONLY the uploaded rows (for the upload page's own search). */
export function uploadedOnly(raw: RawDB, up: UploadStore): RawDB | null {
  const empty: RawDB = {
    meta: { areas: [], organisms: [], specimens: [], specimens_fi: [], results: [], quantities: [], guidelines: [], wards: [], antibiotics: [] },
    patients: [], cultures: [], isolates: [], susceptibility: [],
  };
  const merged = mergeUploads(empty, up);
  if (!merged) return null;
  // fall back to reference meta for any lookups the UI needs (names, classes)
  const m = merged.meta;
  const ref = raw.meta;
  if (!m.guidelines.length) m.guidelines = ref.guidelines;
  if (!m.results.length) m.results = ref.results;
  if (!m.quantities.length) m.quantities = ref.quantities;
  if (!m.specimens.length) { m.specimens = ref.specimens; m.specimens_fi = ref.specimens_fi; }
  if (!m.wards.length) m.wards = ref.wards;
  if (!m.antibiotics.length) m.antibiotics = ref.antibiotics;
  if (!m.organisms.length) m.organisms = ref.organisms;
  if (!m.areas.length) m.areas = ref.areas;
  return merged;
}
