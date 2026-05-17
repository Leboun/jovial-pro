import { supabase } from "./supabase";

export type ProfileRole = "user" | "establishment";

export async function getProfileRole(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as ProfileRole | undefined) ?? null;
}
