import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "patient" | "doctor" | "rnd";
export type Session = { role: Role; user: string; patientId?: string };
const KEY = "microbelog-session";

type Ctx = { session: Session | null; ready: boolean; login: (s: Session) => void; logout: () => void };
const AuthCtx = createContext<Ctx>({ session: null, ready: false, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setSession(JSON.parse(s)); } catch { /* ignore */ }
    setReady(true);
  }, []);
  const login = (s: Session) => { localStorage.setItem(KEY, JSON.stringify(s)); setSession(s); };
  const logout = () => { localStorage.removeItem(KEY); setSession(null); };
  return <AuthCtx.Provider value={{ session, ready, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
