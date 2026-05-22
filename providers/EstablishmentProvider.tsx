import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import {
  EstablishmentProfile,
  EstablishmentSubscription,
  getBackOfficeEstablishment,
  getSubscription,
} from "../services/establishment";

type EstablishmentContextValue = {
  venue: EstablishmentProfile | null;
  subscription: EstablishmentSubscription | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const EstablishmentContext = createContext<EstablishmentContextValue | undefined>(undefined);

export function EstablishmentProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [venue, setVenue] = useState<EstablishmentProfile | null>(null);
  const [subscription, setSubscription] = useState<EstablishmentSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setVenue(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const v = await getBackOfficeEstablishment(userId);
      setVenue(v);
      if (v) {
        const sub = await getSubscription(v.id).catch(() => null);
        setSubscription(sub);
      } else {
        setSubscription(null);
      }
    } catch {
      setVenue(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const value = useMemo(
    () => ({ venue, subscription, loading, refresh }),
    [venue, subscription, loading, refresh]
  );

  return (
    <EstablishmentContext.Provider value={value}>
      {children}
    </EstablishmentContext.Provider>
  );
}

export function useEstablishment() {
  const ctx = useContext(EstablishmentContext);
  if (!ctx) throw new Error("useEstablishment doit être utilisé à l'intérieur de <EstablishmentProvider />");
  return ctx;
}
