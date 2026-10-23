import { useState } from "react";
import { FlaskConical, Stethoscope, User, Lock } from "lucide-react";
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
  const r = roles.find((x) => x.role === tab)!;
  const fi = lang === "fi";

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (tab !== "patient") return login({ role: tab, user: r.user });
    if (!db) return;
    const p = (pid ?? firstP).trim(), c = (cid ?? firstC).trim();
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
              <label className="block text-xs font-medium">{fi ? "Potilastunnus" : "Patient ID"}
                <input className={input} value={pid ?? firstP} onChange={(e) => setPid(e.target.value)} /></label>
              <label className="block text-xs font-medium">{fi ? "Näytetunnus (culture ID)" : "Culture ID"}
                <input className={input} value={cid ?? firstC} onChange={(e) => setCid(e.target.value)} /></label>
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
