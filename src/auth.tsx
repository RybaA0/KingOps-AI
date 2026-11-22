import React, { createContext, useContext, useEffect, useState } from "react";
import { loadToken, getMe, logout as apiLogout, type User } from "./api";

type AuthState = {
  ready: boolean;
  user: User | null;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);
export const useAuth = (): AuthState => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        const me = await getMe();
        if (me) setUser({ name: me.name, email: me.email, role: me.role });
      }
      setReady(true);
    })();
  }, []);

  const signOut = async () => { await apiLogout(); setUser(null); };

  return <Ctx.Provider value={{ ready, user, setUser, signOut }}>{children}</Ctx.Provider>;
}
