import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";

export function useIsPremium() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setIsPremium(false); setLoading(false); return; }
    supabase
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle()
      .then(({ data }) => {
        setIsPremium(!!data);
        setLoading(false);
      });
  }, [userId]);

  return { isPremium, loading };
}
