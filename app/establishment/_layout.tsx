import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Stack, usePathname } from "expo-router";
import { supabase } from "@/services/supabase";

export default function EstablishmentLayout() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const prev = prevPathname.current;
    prevPathname.current = pathname;
    if (prev.startsWith("/establishment/") && !pathname.startsWith("/establishment/")) {
      supabase.auth.signOut();
    }
  }, [pathname]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
