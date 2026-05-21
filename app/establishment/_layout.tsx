import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { supabase } from "@/services/supabase";

export default function EstablishmentLayout() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleHide = () => supabase.auth.signOut();
    window.addEventListener("pagehide", handleHide);
    return () => window.removeEventListener("pagehide", handleHide);
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
