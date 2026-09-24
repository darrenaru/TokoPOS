import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "../services/api";
import type { Pengguna } from "../types";

interface AuthContextValue {
  user: Pengguna | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Pengguna | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .currentSession()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const loggedIn = await authApi.login(username, password);
    setUser(loggedIn);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
