// mobile/hooks/useVenueTags.ts
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export function useVenueTags(venueId?: number) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venueId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadTags = async () => {
      const { data, error } = await supabase
        .from("venue_venue_tags")
        .select("venue_tags(name)")
        .eq("venue_id", venueId);

      if (!isMounted) return;

      if (error) {
        console.warn("❌ Error loading venue tags:", error);
        setError(error.message);
        setTags([]);
        setLoading(false);
        return;
      }

      const names =
        data
          ?.map((row: any) => row.venue_tags?.name)
          .filter((x: string | undefined): x is string => Boolean(x)) ?? [];

      setTags(names);
      setLoading(false);
    };

    loadTags();

    return () => {
      isMounted = false;
    };
  }, [venueId]);

  return { tags, loading, error };
}
