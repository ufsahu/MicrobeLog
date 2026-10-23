import { useState } from "react";
import { FlaskConical, Stethoscope, User, Lock, Search } from "lucide-react";
import logo from "@/assets/microbelog-logo.png";
import { useAuth, type Role } from "@/lib/auth";
import { useDB } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { LangToggle } from "@/components/AppShell";

const roles: { role: Role; icon: typeof User; en: string; fi: string; user: string; dEn: string; dFi: string }[] = [
  { role: "patient", icon: User, en: "Patient Login", fi: "Potilaan kirjautuminen", user: "", dEn: "View your own results using your patient ID and culture ID.", dFi: "Näe omat tuloksesi potilastunnuksella ja näytetunnuksella." },
  { role: "doctor", icon: Stethoscope, en: "Doctor Login", fi: "Lääkärin kirjautuminen", user: "dr.virtanen", dEn: "Full clinical access to all patients and tools.", dFi: "Täysi kliininen pääsy kaikkiin potilaisiin ja työkaluihin." },
  { role: "rnd", icon: FlaskConical, en: "R&D Login", fi: "T&K-kirjautuminen", user: "rnd.researcher", dEn: "Full access for research, analysis and export.", dFi: "Täysi pääsy tutkimukseen, analyysiin ja vientiin." },
];

export function LoginScreen() {
  const { lang } = useLang();
  const { login } = useAuth();
  const { data: db } = useDB();
  const [tab, setTab] = useState<Role>("doctor");
  const firstP = db?.patients[0]?.id ?? "";
  const firstC = db?.cultures.find((c) => db.patients[c.p]?.id === firstP)?.id ?? db?.cultures.find(() => true)?.id ?? "";
  const [pid, setPid] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState("");
  const [open, setOpen] = useState(false);
  const q = (pid ?? "").trim().toUpperCase();
  const suggestions = db && q ? db.patients.filter((x) => x.id.toUpperCase().includes(q)).slice(0, 8) : [];
  const pick = (id: string) => {
    setPid(id); setOpen(false);
    const c = db?.cultures.find((x) => db.patients[x.p]?.id === id);
    if (c) setCid(c.id);
  };
  const r = roles.find((x) => x.role === tab)!;
  const fi = lang === "fi";

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (tab !== "patient") return login({ role: tab, user: r.user });
    if (!db) return;
    if (!pw.trim()) { setErr(fi ? "Kirjoita salasana." : "Please type a password."); return; }
    const p = (pid ?? firstP).trim().toUpperCase(), c = (cid ?? firstC).trim().toUpperCase();
    const patient = db.patients.find((x) => x.id === p);
    const culture = db.cultures.find((x) => x.id === c);
    if (!patient || !culture || db.patients[culture.p]?.id !== p) {
      setErr(fi ? "Potilastunnus ja näytetunnus eivät täsmää." : "Patient ID and culture ID do not match.");
      return;
    }
    login({ role: "patient", user: p, patientId: p });
  };

  const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end"><LangToggle /></div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <img src={logo} alt="MicrobeLog" width={1536} height={512} className="mx-auto mb-5 h-12 w-auto" />
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
            {roles.map(({ role, icon: I, en, fi: f }) => (
              <button key={role} type="button" onClick={() => { setTab(role); setErr(""); }}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold ${tab === role ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}>
                <I className="h-4 w-4" />{(fi ? f : en).replace(/ ?(Login|kirjautuminen)/i, "")}
              </button>))}
          </div>
          <h1 className="text-xl font-semibold">{fi ? r.fi : r.en}</h1>
          <p className="mb-4 text-sm text-muted-foreground">{fi ? r.dFi : r.dEn}</p>
          <form onSubmit={submit} className="space-y-3">
            {tab === "patient" ? (<>
              <div className="relative">
                <label className="block text-xs font-medium">{fi ? "Hae potilastunnus" : "Search patient ID"}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input className={`${input} pl-9`} placeholder={fi ? "esim. P000123" : "e.g. P000123"} value={pid ?? firstP} autoComplete="off"
                      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
                      onChange={(e) => { setPid(e.target.value); setOpen(true); }} />
                  </div></label>
                {open && suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-card">
                    {suggestions.map((s) => (
                      <li key={s.id}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s.id)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-secondary">
                        <span className="font-mono">{s.id}</span><span className="text-xs text-muted-foreground">{s.sex} · {s.birth} · {s.area}</span>
                      </button></li>))}
                  </ul>)}
              </div>
              <label className="block text-xs font-medium">{fi ? "Näytetunnus (culture ID)" : "Culture ID"}
                <input className={input} value={cid ?? firstC} onChange={(e) => setCid(e.target.value)} /></label>
              <label className="block text-xs font-medium">{fi ? "Salasana" : "Password"}
                <input className={input} type="password" placeholder={fi ? "Kirjoita mikä tahansa salasana" : "Type any password"} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            </>) : (<>
              <label className="block text-xs font-medium">{fi ? "Käyttäjätunnus" : "Username"}
                <input className={input} value={r.user} readOnly /></label>
              <label className="block text-xs font-medium">{fi ? "Salasana" : "Password"}
                <input className={input} type="password" value="demo-password" readOnly /></label>
            </>)}
            {err && <p className="text-sm text-destructive">{err}</p>}
            <button type="submit" disabled={tab === "patient" && !db}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Lock className="h-4 w-4" />{fi ? "Kirjaudu" : "Login"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">{fi ? "Demo: tunnukset on esitäytetty, oikeaa salasanaa ei tarvita." : "Demo: credentials are pre-filled, no real password required."}</p>
        </div>
      </div>
    </div>
  );
}
