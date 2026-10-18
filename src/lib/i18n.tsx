import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DB } from "./data";

export type Lang = "en" | "fi";

const dict = {
  overview: ["Overview", "Yleiskatsaus"],
  resistance: ["Resistance", "Resistenssi"],
  monitoring: ["Monitoring", "Seuranta"],
  explorer: ["Datasets", "Aineistot"],
  patients: ["Patients", "Potilaat"],
  quantity: ["Bacterial load", "Bakteerimäärä"],
  predictions: ["Predictions", "Ennusteet"],
  microscopy: ["Microscopy", "Mikroskopia"],
  export: ["Export & R", "Vienti & R"],
  chat: ["Ask AI", "Kysy tekoälyltä"],
  upload: ["Upload New Data", "Lataa uusia tietoja"],
  more: ["More", "Lisää"],
  loading: ["Loading surveillance data…", "Ladataan seuranta-aineistoa…"],
  synthetic: ["All data is synthetic — no real patients.", "Kaikki tiedot ovat keksittyjä — ei todellisia potilaita."],
  patients_n: ["Patients", "Potilaat"],
  cultures_n: ["Cultures", "Viljelyt"],
  isolates_n: ["Isolates", "Isolaatit"],
  sus_n: ["Susceptibility tests", "Herkkyysmääritykset"],
  rule_title: ["Surveillance rule", "Seurantasääntö"],
  rule_text: [
    "Only the first isolate per patient per species per specimen type per period is counted. A percentage is shown only with at least 30 isolates.",
    "Vain potilaan ensimmäinen isolaatti samaa lajia samasta näytetyypistä jakson aikana lasketaan. Prosentti näytetään vasta kun isolaatteja on vähintään 30.",
  ],
  organism: ["Organism", "Mikrobi"],
  specimen: ["Specimen", "Näyte"],
  sex: ["Sex", "Sukupuoli"],
  ward: ["Ward", "Osasto"],
  institution: ["Institution", "Laitos"],
  ward_type: ["Ward type", "Avo/osasto"],
  age: ["Age group", "Ikäryhmä"],
  area: ["Home area", "Asuinalue"],
  origin: ["Origin", "Alkuperä"],
  all: ["All", "Kaikki"],
  female: ["Women", "Naiset"],
  male: ["Men", "Miehet"],
  hospital: ["Hospital", "Sairaala"],
  primary_care: ["Primary care", "Perusterveydenhuolto"],
  inpatient: ["Inpatient", "Osastopotilas"],
  outpatient: ["Outpatient", "Avohoito"],
  hai: ["Hospital-acquired (≥ day 3)", "Sairaalasyntyinen (≥ 3. hoitopäivä)"],
  community: ["Community", "Avohoitoperäinen"],
  reset: ["Reset", "Tyhjennä"],
  antibiotic: ["Antibiotic", "Antibiootti"],
  resistant: ["Resistant", "Resistentti"],
  susceptible: ["Susceptible", "Herkkä"],
  tested: ["Tested (first isolates)", "Testattu (ensimmäiset isolaatit)"],
  r_pct: ["Resistant %", "Resistenttien %"],
  last4: ["Last 4 weeks", "Viimeiset 4 viikkoa"],
  annual: ["Annual", "Vuosittain"],
  updated: ["Data up to", "Tiedot päivään"],
  search: ["Search…", "Hae…"],
  open: ["Open", "Avaa"],
  download: ["Download", "Lataa"],
  phenotypes: ["Resistance phenotypes", "Resistenssi-ilmiasut"],
  sex_diff: ["Urinary E. coli: women vs men", "Virtsan E. coli: naiset vs miehet"],
  trend: ["Weekly trend", "Viikkotrendi"],
  forecast: ["Forecast", "Ennuste"],
  condition: ["Likely condition", "Todennäköinen tila"],
  risk: ["Risk", "Riski"],
  high: ["High", "Korkea"],
  mid: ["Moderate", "Kohtalainen"],
  low: ["Low", "Matala"],
  disclaimer: [
    "Illustrative decision support only — the dataset contains no diagnoses. Always confirm clinically.",
    "Vain havainnollistava päätöksenteon tuki — aineistossa ei ole diagnooseja. Varmista aina kliinisesti.",
  ],
  ask_placeholder: ["Ask in plain English or Finnish…", "Kysy tavallisella suomella tai englanniksi…"],
  send: ["Send", "Lähetä"],
} as const;

export type Key = keyof typeof dict;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string };
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => dict[k][0] });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const s = localStorage.getItem("microbelog-lang");
    if (s === "fi" || s === "en") setLangState(s);
  }, []);
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem("microbelog-lang", l); document.documentElement.lang = l; };
  const t = (k: Key) => dict[k][lang === "en" ? 0 : 1];
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}
export const useLang = () => useContext(LangCtx);

/** Localised names from the dataset's own Finnish/English columns. */
export function names(db: DB, lang: Lang) {
  return {
    ward: (i: number) => (lang === "fi" ? db.meta.wards[i].ward_fi : db.meta.wards[i].ward_en),
    spec: (i: number) => (lang === "fi" ? db.meta.specimens_fi[i] : db.meta.specimens[i]),
    ab: (i: number) => (lang === "fi" ? db.meta.antibiotics[i].antibiotic_fi : db.meta.antibiotics[i].antibiotic),
    result: (i: number) => {
      const r = db.meta.results[i];
      if (lang === "en") return r.replace("_", " ");
      return r === "positive" ? "positiivinen" : r === "negative" ? "negatiivinen" : "sekakasvu";
    },
  };
}
