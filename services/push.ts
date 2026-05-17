import { Platform } from "react-native";

import { supabase } from "./supabase";
import { ensureNotificationPermissions } from "./notifications";

const resolveProjectId = async () => {
  const { default: Constants } = await import("expo-constants");
  const expoConfig = Constants.expoConfig ?? Constants.manifest;
  const extra = (expoConfig as any)?.extra;
  return (
    Constants.easConfig?.projectId ||
    extra?.eas?.projectId ||
    extra?.projectId ||
    undefined
  );
};

export async function registerPushToken(userId: string) {
  if (Platform.OS === "web") return;
  const allowed = await ensureNotificationPermissions();
  if (!allowed) return;

  const Notifications = await import("expo-notifications");
  const projectId = await resolveProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenResponse?.data;
  if (!token) return;

  await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
      device: Platform.OS,
    },
    { onConflict: "token" }
  );
}
