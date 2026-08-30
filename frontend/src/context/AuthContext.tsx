import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, REFRESH_TOKEN_KEY, TOKEN_KEY } from "@/src/lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  goals: any;
  intervals_connected: boolean;
  intervals_athlete_id: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) {
      try {
        const me = await api.get("/auth/me");
        setUser(me);
      } catch {
        await storage.secureRemove(TOKEN_KEY);
        await storage.secureRemove(REFRESH_TOKEN_KEY);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await storage.secureSet(TOKEN_KEY, res.access_token);
    await storage.secureSet(REFRESH_TOKEN_KEY, res.refresh_token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api.post("/auth/register", { email, password, name });
    await storage.secureSet(TOKEN_KEY, res.access_token);
    await storage.secureSet(REFRESH_TOKEN_KEY, res.refresh_token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort server logout; always clear local session below.
    }
    await storage.secureRemove(TOKEN_KEY);
    await storage.secureRemove(REFRESH_TOKEN_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
