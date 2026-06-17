import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { Platform } from "react-native";
import { supabase } from "../services/supabase";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, newSession: Session | null) => {
      setSession(newSession ?? null);
      }
    );

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || Platform.OS === "web") return;
    import("../services/push")
      .then(({ registerPushToken }) => registerPushToken(userId))
      .catch(() => undefined);
    // Identifie l'utilisateur aupres de RevenueCat (no-op tant que les cles ne sont pas la)
    import("../services/purchases")
      .then(({ configurePurchases }) => configurePurchases(userId))
      .catch(() => undefined);
  }, [session?.user?.id]);

  const value = useMemo(() => ({ session, loading }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l’intérieur de <AuthProvider />");
  return ctx;
}
