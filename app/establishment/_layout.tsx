import { useEffect } from "react";
import { Stack } from "expo-router";
import { supabase } from "@/services/supabase";

export default function EstablishmentLayout() {
  useEffect(() => {
    return () => {
      supabase.auth.signOut();
    };
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
