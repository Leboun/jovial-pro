import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { checkPremiumEntitlement } from "@/services/purchases";

export function useIsPremium() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsPremium(false);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      // 1) Source de verite : RevenueCat (si dispo dans le build + cles configurees)
      const rc = await checkPremiumEntitlement();
      if (cancelled) return;
      if (rc !== null) {
        setIsPremium(rc);
        setLoading(false);
        return;
      }

      // 2) Repli : table Supabase user_subscriptions (plan + expires_at)
      const { data } = await supabase
        .from("user_subscriptions")
        .select("plan, expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const active =
        data?.plan === "premium" &&
        (!data.expires_at || new Date(data.expires_at) > new Date());
      setIsPremium(!!active);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isPremium, loading };
}
