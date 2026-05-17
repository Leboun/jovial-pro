import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const REMINDER_PREFIX = "event_reminder_";
const CHANNEL_ID = "event_reminders";

let notificationsModulePromise: Promise<typeof import("expo-notifications")> | null = null;
let notificationHandlerConfigured = false;

async function getNotificationsModule() {
  if (Platform.OS === "web") return null;
  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications");
  }
  const Notifications = await notificationsModulePromise;
  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // No in-app pop when user just interacted; notifications show only when app is in background.
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerConfigured = true;
  }
  return Notifications;
}

async function ensureChannel() {
  const Notifications = await getNotificationsModule();
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Event reminders",
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: undefined,
    lightColor: "#FFFFFF",
  });
}

export async function ensureNotificationPermissions() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  const settings = await Notifications.getPermissionsAsync();
  const granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (granted) return true;

  const request = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });

  return (
    request.granted ||
    request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function formatTime(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseEventDate(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const [startPart] = trimmed.split(/\s-\s/);
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(startPart);
  const normalized = startPart.includes("T") ? startPart : startPart.replace(" ", "T");

  if (hasTimezone) {
    const withZone = new Date(normalized);
    if (!Number.isNaN(withZone.getTime())) return withZone;
  }

  const match = normalized.match(
    /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/
  );
  if (!match) {
    const fallback = new Date(normalized);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day, hours = "0", minutes = "0"] = match;
  const localDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );
  return Number.isNaN(localDate.getTime()) ? null : localDate;
}

export async function scheduleEventReminder(params: {
  eventId: number;
  title: string;
  startsAt: string;
  status: "interested" | "going";
}) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const { eventId, title, startsAt, status } = params;
  const eventDate = parseEventDate(startsAt);
  if (!eventDate) return null;

  const triggerDate = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  if (triggerDate <= new Date()) return null;

  await ensureChannel();
  const allowed = await ensureNotificationPermissions();
  if (!allowed) return null;

  const storageKey = `${REMINDER_PREFIX}${eventId}`;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const staleReminders = scheduled.filter(
    (item) => (item.content.data as { eventId?: number } | undefined)?.eventId === eventId
  );
  for (const reminder of staleReminders) {
    await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
  }

  const existingId = await AsyncStorage.getItem(storageKey);
  if (existingId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    } catch {
      // Ignore stale ids.
    }
  }

  const timeLabel = formatTime(eventDate);
  const statusLabel = status === "going" ? "vous y allez" : "vous etes interesse";
  const dateLabel = eventDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const body = `Rappel: ${statusLabel}. Le ${dateLabel} a ${timeLabel}.`;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: title || "Événement",
      body,
      data: { eventId },
    },
    trigger: {
      date: triggerDate,
      channelId: CHANNEL_ID,
    },
  });

  await AsyncStorage.setItem(storageKey, id);
  return id;
}

export async function cancelEventReminder(eventId: number) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const storageKey = `${REMINDER_PREFIX}${eventId}`;
  const existingId = await AsyncStorage.getItem(storageKey);
  if (!existingId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  } catch {
    // Ignore stale ids.
  }

  await AsyncStorage.removeItem(storageKey);
}

export async function scheduleReservationReminders(params: {
  activityName: string;
  venueName: string;
  startsAt: Date;
}) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const { activityName, venueName, startsAt } = params;
  const label = [activityName, venueName].filter(Boolean).join(" chez ");

  const minus24h = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  const minus1h  = new Date(startsAt.getTime() -      60 * 60 * 1000);
  const now = new Date();

  if (minus24h > now) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rappel — demain !",
        body: `Votre réservation "${label}" est prévue demain. Prêt ?`,
        data: {},
      },
      trigger: { date: minus24h, channelId: CHANNEL_ID },
    });
  }

  if (minus1h > now) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Dans 1 heure !",
        body: `Votre réservation "${label}" commence dans 1 heure. À tout de suite !`,
        data: {},
      },
      trigger: { date: minus1h, channelId: CHANNEL_ID },
    });
  }
}
