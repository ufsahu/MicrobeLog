import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, FlaskRound, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { useDB, firstIsolates, resistanceFor, lastNDays, type DB } from "@/lib/data";
import { patientRisk } from "@/lib/clinical";
import { useLang } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/chat")({
  head: () => seo("Ask AI", "Ask questions about the surveillance datasets in plain English or Finnish."),
  component: Chat,
});

type Msg = { role: "user" | "assistant"; content: string };

function buildContext(db: DB) {
  const L: string[] = [];
  const A = db.meta.antibiotics;
  L.push(`Totals: ${db.patients.length} patients, ${db.cultures.length} cultures, ${db.isolates.length} isolates. Period 2023-10-02..${new Date(db.maxT).toISOString().slice(0, 10)}.`);
  L.push(`Wards: ${db.meta.wards.map((w) => `${w.ward_code}=${w.ward_en}/${w.ward_fi}(${w.ward_type},${w.institution})`).join("; ")}`);
  L.push(`Antibiotics: ${A.map((a) => `${a.antibiotic_code}=${a.antibiotic}/${a.antibiotic_fi}`).join("; ")}`);
  L.push("\nFIRST-ISOLATE RESISTANCE % (year|specimen|organism|sex: code=pct(n)) — only n>=30:");
  for (const y of [2023, 2024, 2025, 2026]) for (let s = 0; s < 3; s++) for (let o = 0; o < db.meta.organisms.length; o++) {
    const base = db.isolates.filter((i) => i.year === y && i.spec === s && i.org === o);
    for (const sx of ["all", "F", "M"] as const) {
      const l = firstIsolates(sx === "all" ? base : base.filter((i) => i.sex === sx), (i) => i.year);
      if (l.length < 30) continue;
      const cells = A.map((a, k) => { const r = resistanceFor(l, k); return r.pct === null ? null : `${a.antibiotic_code}=${r.pct.toFixed(1)}(${r.n})`; }).filter(Boolean);
      if (cells.length) L.push(`${y}|${db.meta.specimens[s]}|${db.meta.organisms[o]}|${sx}: ${cells.join(" ")}`);
    }
  }
  const recent = firstIsolates(db.isolates.filter(lastNDays(db, 28)));
  L.push(`\nLAST 4 WEEKS: ${recent.length} first isolates; ESBL ${recent.filter((i) => i.esbl).length}, MRSA ${recent.filter((i) => i.mrsa).length}, VRE ${recent.filter((i) => i.vre).length}, CPE ${recent.filter((i) => i.cpe).length}. By organism: ${db.meta.organisms.map((o, k) => `${o} ${recent.filter((i) => i.org === k).length}`).join(", ")}`);
  const ph = (y: number) => { const l = firstIsolates(db.isolates.filter((i) => i.year === y), (i) => i.year); return `${y}: ESBL ${l.filter((i) => i.esbl).length}, MRSA ${l.filter((i) => i.mrsa).length}, VRE ${l.filter((i) => i.vre).length}, CPE ${l.filter((i) => i.cpe).length}`; };
  L.push(`Phenotypes (first isolates): ${[2023, 2024, 2025, 2026].map(ph).join("; ")}`);
  const q: Record<string, number> = {}; db.isolates.forEach((i) => { const k = `${db.meta.specimens[i.spec]} ${db.meta.quantities[i.qty] || "n/a"}`; q[k] = (q[k] ?? 0) + 1; });
  L.push(`Quantity counts: ${Object.entries(q).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  L.push(`Ward culture counts: ${db.meta.wards.map((w, k) => `${w.ward_code} ${db.cultures.filter((c) => c.ward === k).length}`).join(", ")}`);
  return L.join("\n");
}

function patientContext(db: DB, text: string) {
  const ids = [...new Set(text.toUpperCase().match(/P\d{6}/g) ?? [])].slice(0, 3);
  return ids.map((id) => {
    const p = db.patients.find((x) => x.id === id); if (!p) return `${id}: not found`;
    const r = patientRisk(db, p);
    const rows = r.cultures.map((c) => {
      const isos = (db.isolatesByCulture.get(c.idx) ?? []).map((i) => db.isolates[i]);
      return `- ${c.date} ${db.meta.specimens[c.spec]} ${db.meta.wards[c.ward].ward_code} age ${c.age} ${db.meta.results[c.result]}${c.hai ? " HAI" : ""}: ` +
        isos.map((i) => `${db.meta.organisms[i.org]} qty ${db.meta.quantities[i.qty] || "n/a"}${i.esbl ? " ESBL" : ""}${i.mrsa ? " MRSA" : ""}${i.vre ? " VRE" : ""}${i.cpe ? " CPE" : ""} [${i.sus.split("").map((s, k) => (s === "." ? "" : `${db.meta.antibiotics[k].antibiotic_code}:${s}`)).filter(Boolean).join(" ")}]`).join("; ");
    });
    return `PATIENT ${p.id}: sex ${p.sex}, born ${p.birth}, area ${p.area}, risk score ${r.score} (${r.reasons.join(",")})\n${rows.join("\n")}`;
  }).join("\n");
}

function Chat() {
  const { data: db } = useDB();
  const { t, lang } = useLang();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => (db ? buildContext(db) : ""), [db]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => { if (!busy) ta.current?.focus(); }, [busy]);
  if (!db) return null;

  const examples = lang === "en"
    ? ["How resistant is urinary E. coli to ciprofloxacin in women vs men?", "How many MRSA cases in the last 4 weeks?", "Explain patient P000002 in simple words", "Is a 10^4 urine result dangerous?"]
    : ["Kuinka resistentti virtsan E. coli on siprofloksasiinille naisilla ja miehillä?", "Montako MRSA-tapausta viimeisen 4 viikon aikana?", "Selitä potilas P000002 selkokielellä", "Onko 10^4 virtsatulos vaarallinen?"];

  async function send(text: string) {
    if (!text.trim() || busy || !db) return;
    setErr(null);
    const next: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs([...next, { role: "assistant", content: "" }]); setInput(""); setBusy(true);
    try {
      const pc = patientContext(db, next.map((m) => m.content).join(" "));
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context: ctx + (pc ? "\n\n" + pc : "") }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = "";
      for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); setMsgs([...next, { role: "assistant", content: acc }]); }
      if (!acc) throw new Error(lang === "en" ? "No answer received." : "Vastausta ei saatu.");
    } catch (e) {
      setMsgs(next); setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col lg:h-[calc(100vh-7rem)]">
      <PageHeader title={t("chat")} sub={t("synthetic")} right={msgs.length > 0 && <button onClick={() => setMsgs([])} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><RotateCcw className="h-4 w-4" />{lang === "en" ? "New conversation" : "Uusi keskustelu"}</button>} />
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-card">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-hero"><FlaskRound className="h-7 w-7 text-primary-foreground" /></div>
            <p className="max-w-md text-sm text-muted-foreground">{lang === "en" ? "Ask anything about resistance, wards, bacteria counts or a patient ID." : "Kysy mitä tahansa resistenssistä, osastoista, bakteerimääristä tai potilastunnuksella."}</p>
            <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">{examples.map((e) => <button key={e} onClick={() => send(e)} className="rounded-lg border border-border bg-secondary px-3 py-2 text-left text-sm text-secondary-foreground hover:border-primary">{e}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.content}</div></div>
        ) : (
          <div key={i} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hero"><FlaskRound className="h-4 w-4 text-primary-foreground" /></div>
            <div className="prose prose-sm max-w-none text-sm text-foreground [&_table]:text-xs [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5">
              {m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span className="inline-flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" /><span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" /></span>}
            </div>
          </div>
        ))}
        {err && <div className="rounded-lg bg-risk-high-soft px-3 py-2 text-sm text-risk-high">{err}</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-card">
        <textarea ref={ta} value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder={t("ask_placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm focus:outline-none" />
        <button type="submit" disabled={busy || !input.trim()} aria-label={t("send")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground disabled:opacity-40"><ArrowUp className="h-5 w-5" /></button>
      </form>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">{t("disclaimer")} <Link to="/explorer" className="underline">{t("explorer")}</Link></p>
    </div>
  );
}
