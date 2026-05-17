import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const expoEndpoint = "https://exp.host/--/api/v2/push/send";

type Payload = {
  group_id: number;
  post_id: number;
  author_id?: string | null;
  body?: string | null;
  is_important?: boolean;
  is_pinned?: boolean;
  mention_user_ids?: string[];
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const chunk = <T,>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

function shortBody(body?: string | null) {
  const trimmed = String(body ?? "").trim();
  if (!trimmed) return "Nouvelle publication dans le groupe.";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response("Missing server configuration", { status: 500 });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const groupId = Number(payload.group_id);
  const postId = Number(payload.post_id);
  if (!Number.isFinite(groupId) || !Number.isFinite(postId)) {
    return new Response("Missing group_id or post_id", { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: group } = await supabaseAdmin
    .from("community_groups")
    .select("id, name")
    .eq("id", groupId)
    .maybeSingle();

  const { data: members } = await supabaseAdmin
    .from("community_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "approved");

  const memberIds = (members ?? [])
    .map((row: any) => row.user_id as string)
    .filter((id) => id && id !== payload.author_id);

  if (memberIds.length === 0) return new Response("ok");

  const { data: defaults } = await supabaseAdmin
    .from("user_group_notification_defaults")
    .select("user_id, enabled, default_level")
    .in("user_id", memberIds);

  const { data: perGroup } = await supabaseAdmin
    .from("community_group_notification_settings")
    .select("user_id, group_id, level, notify_mentions")
    .eq("group_id", groupId)
    .in("user_id", memberIds);

  const defaultsMap = new Map<string, { enabled: boolean; level: "all" | "important" | "none" }>();
  (defaults ?? []).forEach((row: any) => {
    defaultsMap.set(row.user_id, {
      enabled: row.enabled ?? true,
      level: row.default_level ?? "all",
    });
  });

  const groupMap = new Map<string, { level: "all" | "important" | "none"; notify_mentions: boolean }>();
  (perGroup ?? []).forEach((row: any) => {
    groupMap.set(row.user_id, {
      level: row.level ?? "all",
      notify_mentions: row.notify_mentions ?? true,
    });
  });

  const isImportant = Boolean(payload.is_important || payload.is_pinned);
  const mentionIds = (payload.mention_user_ids ?? []).filter((id) => id && id !== payload.author_id);

  const eligibleUsers = memberIds.filter((userId) => {
    const defaultsRow = defaultsMap.get(userId);
    const enabled = defaultsRow?.enabled ?? true;
    if (!enabled) return false;
    const groupSettings = groupMap.get(userId);
    const level = groupSettings?.level ?? defaultsRow?.level ?? "all";
    const notifyMentions = groupSettings?.notify_mentions ?? true;
    if (level === "none") return false;
    if (mentionIds.includes(userId)) return notifyMentions;
    if (level === "important" && !isImportant) return false;
    return level === "all" || isImportant;
  });

  if (eligibleUsers.length === 0) return new Response("ok");

  const { data: tokens } = await supabaseAdmin
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", eligibleUsers);

  const messages: ExpoMessage[] = (tokens ?? []).map((row: any) => ({
    to: row.token as string,
    title: group?.name ? `Groupe: ${group.name}` : "Nouveau message",
    body: shortBody(payload.body),
    data: { groupId, postId },
  }));

  for (const batch of chunk(messages, 100)) {
    await fetch(expoEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
  }

  return new Response("ok");
});
