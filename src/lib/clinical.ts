import type { Culture, DB, Isolate, Patient } from "./data";
import { quantityZone } from "./data";
import type { Lang } from "./i18n";

export type Condition = { en: string; fi: string; level: "high" | "mid" | "low"; why_en: string; why_fi: string };

/** Rule-based, illustrative condition suggestion. The dataset contains no diagnoses. */
export function predictCondition(db: DB, c: Culture, isos: Isolate[], p: Patient): Condition | null {
  if (c.result === 1) return null;
  if (c.result === 2) return { en: "Probable contamination (mixed growth) — repeat sample", fi: "Todennäköinen kontaminaatio (sekakasvu) — uusi näyte", level: "low", why_en: "mixed growth", why_fi: "sekakasvu" };
  const org = isos.map((i) => db.meta.organisms[i.org]).join(", ");
  const resistantFlags = isos.some((i) => i.esbl || i.mrsa || i.vre || i.cpe);
  if (c.spec === 1)
    return { en: "Bacteraemia — sepsis risk", fi: "Bakteremia — sepsiksen riski", level: "high", why_en: `${org} in blood`, why_fi: `${org} veressä` };
  if (c.spec === 2) {
    const heavy = isos.some((i) => quantityZone(db.meta.quantities[i.qty], 2) === "high");
    const ssi = db.meta.wards[c.ward].ward_code === "SURG";
    return {
      en: ssi ? "Surgical site infection" : "Skin & soft-tissue / wound infection", fi: ssi ? "Leikkausalueen infektio" : "Iho- ja pehmytkudos-/haavainfektio",
      level: heavy || resistantFlags ? "high" : "mid", why_en: `${org}, ${heavy ? "heavy growth" : "light/moderate growth"}`, why_fi: `${org}, ${heavy ? "runsas kasvu" : "niukka/kohtalainen kasvu"}`,
    };
  }
  const sig = isos.some((i) => quantityZone(db.meta.quantities[i.qty], 0) === "high");
  const complicated = p.sex === "M" || c.age >= 75 || db.meta.wards[c.ward].ward_type === "in";
  if (!sig) return { en: "Low-count bacteriuria — evaluate symptoms", fi: "Vähäinen bakteriuria — arvioi oireet", level: "low", why_en: `${org} < 10⁵ CFU/mL`, why_fi: `${org} < 10⁵ CFU/ml` };
  return complicated
    ? { en: "Complicated UTI / possible pyelonephritis", fi: "Komplisoitu virtsatieinfektio / mahd. pyelonefriitti", level: resistantFlags ? "high" : "mid", why_en: `${org} ≥ 10⁵ CFU/mL, ${p.sex === "M" ? "male" : c.age >= 75 ? "age ≥ 75" : "inpatient"}`, why_fi: `${org} ≥ 10⁵ CFU/ml, ${p.sex === "M" ? "mies" : c.age >= 75 ? "ikä ≥ 75" : "osastopotilas"}` }
    : { en: "Uncomplicated cystitis", fi: "Komplisoitumaton kystiitti", level: resistantFlags ? "mid" : "low", why_en: `${org} ≥ 10⁵ CFU/mL`, why_fi: `${org} ≥ 10⁵ CFU/ml` };
}

export function condText(c: Condition, lang: Lang) { return { name: lang === "fi" ? c.fi : c.en, why: lang === "fi" ? c.why_fi : c.why_en }; }

/** Simple additive patient risk score (0–100), illustrative only. */
export function patientRisk(db: DB, p: Patient) {
  const cs = (db.culturesByPatient.get(p.idx) ?? []).map((i) => db.cultures[i]);
  const isos = cs.flatMap((c) => (db.isolatesByCulture.get(c.idx) ?? []).map((i) => db.isolates[i]));
  const pos = cs.filter((c) => c.result === 0).length;
  const age = cs.length ? Math.max(...cs.map((c) => c.age)) : new Date(db.maxT).getUTCFullYear() - p.birth;
  let s = 0;
  const reasons: string[] = [];
  if (isos.some((i) => i.esbl || i.mrsa || i.vre || i.cpe)) { s += 30; reasons.push("MDR"); }
  if (cs.some((c) => c.spec === 1 && c.result === 0)) { s += 25; reasons.push("blood+"); }
  if (pos >= 3) { s += 15; reasons.push("recurrent"); }
  if (age >= 75) { s += 15; reasons.push("75+"); }
  if (cs.some((c) => c.hai)) { s += 15; reasons.push("HAI"); }
  const rCount = isos.reduce((n, i) => n + (i.sus.match(/R/g)?.length ?? 0), 0);
  if (rCount >= 5) { s += 10; reasons.push("R≥5"); }
  s = Math.min(100, s);
  return { score: s, level: (s >= 50 ? "high" : s >= 25 ? "mid" : "low") as "high" | "mid" | "low", reasons, cultures: cs, isolates: isos, age };
}
