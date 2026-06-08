import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import PickerField, { PickerGroup, PickerOption } from "@/components/ui/PickerField";
import { isEstablishmentPreviewEnabled } from "@/constants/establishmentPreview";
import { getOfferByKey, resolveOfferKey, type JovialProOfferKey } from "@/constants/jovialPro";
import { useAuth } from "@/providers/AuthProvider";
import { useEstablishment } from "@/providers/EstablishmentProvider";
import { searchPlaces, type PlaceResult } from "@/services/places";
import { supabase } from "@/services/supabase";
import {
  EstablishmentSubscription,
  EstablishmentProfile,
  ensureStubEstablishmentForPro,
  getBackOfficeEstablishment,
  getSubscription,
  updateMyEstablishment,
} from "@/services/establishment";
import { isEstablishmentFicheComplete } from "@/utils/establishmentFiche";
import type { DayKey, OpeningHours } from "@/utils/openingHours";
import { invalidateExploreCache } from "@/services/exploreCache";

type OpeningSlot = { open: string; close: string };

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const LOCAL_DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

const LOCAL_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30;
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
});

const TIMEZONE_OPTIONS = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Brussels",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Zurich",
  "America/New_York",
  "America/Montreal",
];

const TAG_LIMIT_BY_OFFER: Record<JovialProOfferKey, number> = {
  visibilite: 1,
  rayonnement: 2,
  pro: 3,
};
const PROFILE_COMPLETION_BLOCKS = 9;

const TAG_SUGGESTIONS = [
  "Afterwork",
  "Bar a jeux",
  "Billard",
  "Blind Test",
  "Brunch",
  "Cocktails",
  "Concerts",
  "Darts",
  "Flechettes",
  "Happy hour",
  "Karaoke",
  "Palet breton",
  "Quiz",
  "Tapas",
  "Terrasse",
];
const ACTIVITY_SUGGESTIONS = [
  "Flechettes",
  "Palet breton",
  "Billard",
  "Baby-foot",
  "Karaoke",
  "Blind Test",
  "Quiz",
  "Concerts",
  "DJ set",
  "Jeux de societe",
];

const VENUE_TYPE_GROUPS = [
  {
    label: "Bars & boissons",
    types: ["Bar", "Pub", "Bar à bière", "Bar de village", "Bar à vin", "Cocktail bar", "Bar à champagne", "Whisky bar", "Micro-brasserie", "Bar à cocktails sans alcool", "Bar à chicha", "Speakeasy"],
  },
  {
    label: "Restauration",
    types: ["Restaurant", "Bar-restaurant", "Bar à tapas", "Bar à pizzas", "Bar à fromages", "Bar à huîtres"],
  },
  {
    label: "Café & détente",
    types: ["Café", "Salon de thé", "Tiers-lieu", "Bar à chats & chiens"],
  },
  {
    label: "Musique & fête",
    types: ["Club / Discothèque", "Bar dansant", "Piano bar", "Jazz bar", "Karaoké"],
  },
  {
    label: "Jeux & sports",
    types: ["Bar à jeux", "Bar à fléchettes", "Bar à haches", "Bowling", "Salle d'arcade", "Salle de billard", "Sports bar", "Complexe de loisirs", "Parc de loisirs"],
  },
  {
    label: "Extérieur & vue",
    types: ["Bar Rooftop", "Guinguette", "Beach bar"],
  },
  {
    label: "Autres",
    types: ["Bar d'hôtel", "Bar éphémère (pop-up)"],
  },
];

const VENUE_AMBIANCE_OPTIONS = [
  "Calme",
  "Convivial",
  "Festif",
  "Familial",
  "Animé",
  "Compétitif",
  "Ludique",
  "Nocturne",
  "Studieux",
  "Cosy",
  "Romantique",
  "Branché",
  "Décontracté",
  "Afterwork",
  "Soirée entre amis",
  "Musique live",
  "DJ set",
  "Karaoké",
  "Quiz / Blind test",
  "Tournoi",
  "Soirée à thème",
  "Chic",
  "Rétro / Vintage",
  "Bohème",
  "Multiculturel",
  "LGBTQIA+ friendly",
  "Éco-responsable",
  "Pet-friendly",
  "Startup / Créatif",
  "Open mic",
  "Vue panoramique",
  "Intimiste",
  "Grosse ambiance",
  "Dansant",
  "Mixte / Tout public",
  "Jeunes / Étudiants",
  "Bière artisanale",
  "Célébration / Anniversaire",
  "Terrasse",
];

const AMBIANCE_MAX = 2;

const SERVICE_TAGS_OPTIONS = [
  "Wi-Fi",
  "Prises",
  "Accès PMR",
  "Parking",
  "Réservation",
  "Privatisable",
  "Happy Hour",
  "Terrasse",
  "Jardin",
  "Vue",
  "Pet-friendly",
  "LGBTQIA+ friendly",
  "Restauration",
  "Retransmission sportive",
  "Jeux à disposition",
  "Ludothèque",
  "Anniversaires & privatisations",
  "Scène",
  "Projection / Cinéma",
  "Streaming / Esports",
  "Options végétariennes",
  "Espace lounge",
  "Douches",
  "Hébergement",
  "Borne de recharge électrique",
  "Ateliers & workshops",
];
const SERVICE_TAGS_MAX = 4;

// Options pour les menus déroulants de "Ma fiche"
const VENUE_TYPE_PICKER_GROUPS: PickerGroup[] = VENUE_TYPE_GROUPS.map((g) => ({
  label: g.label,
  options: g.types.map((t) => ({ value: t, label: t })),
}));
const VENUE_AMBIANCE_PICKER: PickerOption[] = VENUE_AMBIANCE_OPTIONS.map((a) => ({ value: a, label: a }));
const SERVICE_TAGS_PICKER: PickerOption[] = SERVICE_TAGS_OPTIONS.map((s) => ({ value: s, label: s }));
const PIN_EMOJI_OPTIONS: PickerOption[] = [
  { value: "", label: "Auto (selon l'activité principale)" },
  { value: "🎯", label: "Fléchettes", emoji: "🎯" },
  { value: "🎱", label: "Billard", emoji: "🎱" },
  { value: "⚽", label: "Baby-foot", emoji: "⚽" },
  { value: "🥏", label: "Palet / Pétanque", emoji: "🥏" },
  { value: "🎳", label: "Bowling", emoji: "🎳" },
  { value: "🍺", label: "Beer pong", emoji: "🍺" },
  { value: "🪓", label: "Lancer de hache", emoji: "🪓" },
  { value: "🏓", label: "Ping-pong", emoji: "🏓" },
  { value: "♟️", label: "Échecs", emoji: "♟️" },
  { value: "🃏", label: "Cartes / Poker", emoji: "🃏" },
  { value: "🎲", label: "Jeux de société", emoji: "🎲" },
  { value: "🕹️", label: "Arcade / Rétro", emoji: "🕹️" },
  { value: "🎮", label: "Jeux vidéo", emoji: "🎮" },
  { value: "🎤", label: "Karaoké", emoji: "🎤" },
  { value: "🎵", label: "Blind test / Quiz", emoji: "🎵" },
  { value: "🏆", label: "Tournoi", emoji: "🏆" },
  { value: "🎸", label: "Concert / Live", emoji: "🎸" },
  { value: "🎧", label: "DJ / Soirée", emoji: "🎧" },
  { value: "🎬", label: "Diffusion sport", emoji: "🎬" },
  { value: "🎉", label: "Festif", emoji: "🎉" },
  { value: "🍻", label: "Bar / Pub", emoji: "🍻" },
  { value: "🍷", label: "Bar à vin", emoji: "🍷" },
  { value: "🍸", label: "Cocktails", emoji: "🍸" },
  { value: "☕", label: "Café / Détente", emoji: "☕" },
];

const DAY_CACHE_KEY = "establishment_weekdays_v1";
const TIME_CACHE_KEY = "establishment_time_slots_v1";

const isDayKey = (value: string): value is DayKey =>
  (DAY_KEYS as string[]).includes(value);

const mergeDayOptions = (incoming: { key: DayKey; label: string }[]) => {
  const map = new Map(incoming.map((item) => [item.key, item.label]));
  return DAY_KEYS.map((key) => ({
    key,
    label: map.get(key) ?? LOCAL_DAYS.find((day) => day.key === key)?.label ?? key,
  }));
};

const buildEmptySlots = (): Record<DayKey, OpeningSlot[]> => ({
  mon: Array.from({ length: 3 }, () => ({ open: "", close: "" })),
  tue: Array.from({ length: 3 }, () => ({ open: "", close: "" })),
  wed: Array.from({ length: 3 }, () => ({ open: "", close: "" })),
  thu: Array.from({ length: 3 }, () => ({ open: "", close: "" })),
  fri: Array.from({ length: 3 }, () => ({ open: "", close: "" })),
  sat: Array.from({ length: 3 }, () => ({ open: "", close: "" })),
  sun: Array.from({ length: 3 }, () => ({ open: "", close: "" })),
});

const slotsFromOpeningHours = (openingHours?: OpeningHours | null) => {
  const base = buildEmptySlots();
  if (!openingHours) return base;
  DAY_KEYS.forEach((key) => {
    const periods = openingHours[key] ?? [];
    base[key] = base[key].map((slot, index) => ({
      open: periods[index]?.open ?? slot.open,
      close: periods[index]?.close ?? slot.close,
    }));
  });
  return base;
};

const normalizeOpeningHours = (slots: Record<DayKey, OpeningSlot[]>): OpeningHours => {
  const output: OpeningHours = {};
  DAY_KEYS.forEach((key) => {
    const cleaned = (slots[key] ?? [])
      .map((slot) => ({
        open: slot.open.trim(),
        close: slot.close.trim(),
      }))
      .filter((slot) => slot.open && slot.close);
    if (cleaned.length > 0) output[key] = cleaned;
  });
  return output;
};

const toMinutes = (value?: string | null) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatDisplayedTime = (
  value: string,
  field: "open" | "close",
  relatedOpenValue?: string | null
) => {
  if (!value) return "";
  const display = value === "00:00" ? "Minuit" : value;
  if (field !== "close") return display;
  const closeMinutes = toMinutes(value);
  const openMinutes = toMinutes(relatedOpenValue);
  if (closeMinutes == null || openMinutes == null) return display;
  return closeMinutes <= openMinutes ? `${display} (lendemain)` : display;
};

const normalizeTagValue = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ");

const parseCoordinate = (value: string, min: number, max: number) => {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
};

export default function EstablishmentProfileScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const previewMode = isEstablishmentPreviewEnabled(userId);
  const { venue: ctxVenue, subscription: ctxSubscription, loading: estLoading, refresh: refreshEstablishment } = useEstablishment();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profile, setProfile] = useState<EstablishmentProfile | null>(null);
  const [subscription, setSubscription] = useState<EstablishmentSubscription | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [activityInput, setActivityInput] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
  const [timePicker, setTimePicker] = useState<{
    day: DayKey;
    slotIndex: number;
    field: "open" | "close";
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayKey>("mon");
  const [dayOptions, setDayOptions] = useState(LOCAL_DAYS);
  const [timeOptions, setTimeOptions] = useState(LOCAL_TIME_OPTIONS);

  const [form, setForm] = useState({
    name: "",
    city: "",
    address: "",
    postcode: "",
    description: "",
    social_platform: "instagram" as "instagram" | "facebook",
    social_url: "",
    website_url: "",
    phone: "",
    lat: "",
    lng: "",
    darts_targets_count: "",
    timezone: "Europe/Paris",
    activities: [] as string[],
    tags: [] as string[],
    venue_type: "" as string,
    venue_ambiance: [] as string[],
    service_tags: [] as string[],
    pin_emoji: "" as string,
    opening_hours: buildEmptySlots(),
  });

  useEffect(() => {
    let cancelled = false;

    const loadOptionLists = async () => {
      try {
        const [cachedDaysRaw, cachedTimesRaw] = await Promise.all([
          AsyncStorage.getItem(DAY_CACHE_KEY),
          AsyncStorage.getItem(TIME_CACHE_KEY),
        ]);

        if (cachedDaysRaw) {
          const cachedDays = JSON.parse(cachedDaysRaw) as { key: string; label: string }[];
          const cleanedDays = Array.isArray(cachedDays)
            ? cachedDays
                .map((item) => ({
                  key: item?.key,
                  label: String(item?.label ?? "").trim(),
                }))
                .filter((item) => item.key && isDayKey(item.key) && item.label)
                .map((item) => ({ key: item.key as DayKey, label: item.label }))
            : [];
          if (!cancelled && cleanedDays.length > 0) {
            setDayOptions(mergeDayOptions(cleanedDays));
          }
        }

        if (cachedTimesRaw) {
          const cachedTimes = JSON.parse(cachedTimesRaw) as string[];
          const cleanedTimes = Array.isArray(cachedTimes)
            ? cachedTimes.map((item) => String(item ?? "").trim()).filter(Boolean)
            : [];
          if (!cancelled && cleanedTimes.length > 0) {
            setTimeOptions(cleanedTimes);
          }
        }
      } catch {
        // Fall back to local defaults.
      }

      try {
        const [{ data: weekdaysData }, { data: timeSlotsData }] = await Promise.all([
          supabase
            .from("weekdays")
            .select("key, label, sort_order")
            .order("sort_order", { ascending: true }),
          supabase
            .from("time_slots")
            .select("minutes, label")
            .order("minutes", { ascending: true }),
        ]);

        if (!cancelled && Array.isArray(weekdaysData) && weekdaysData.length > 0) {
          const cleanedDays = weekdaysData
            .map((item) => ({
              key: item?.key,
              label: String(item?.label ?? "").trim(),
            }))
            .filter((item) => item.key && isDayKey(item.key) && item.label)
            .map((item) => ({ key: item.key as DayKey, label: item.label }));

          if (cleanedDays.length > 0) {
            const merged = mergeDayOptions(cleanedDays);
            setDayOptions(merged);
            AsyncStorage.setItem(DAY_CACHE_KEY, JSON.stringify(merged)).catch(() => undefined);
          }
        }

        if (!cancelled && Array.isArray(timeSlotsData) && timeSlotsData.length > 0) {
          const cleanedTimes = timeSlotsData
            .map((item) => String(item?.label ?? "").trim())
            .filter(Boolean);
          if (cleanedTimes.length > 0) {
            setTimeOptions(cleanedTimes);
            AsyncStorage.setItem(TIME_CACHE_KEY, JSON.stringify(cleanedTimes)).catch(
              () => undefined
            );
          }
        }
      } catch {
        // Fall back to cache/local defaults.
      }
    };

    loadOptionLists();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let establishment: EstablishmentProfile | null = await getBackOfficeEstablishment(userId);
        if (!establishment && previewMode) {
          establishment = await ensureStubEstablishmentForPro(userId);
        }
        if (!establishment) {
          if (!cancelled) setProfile(null);
          return;
        }
        const sub = await getSubscription(establishment.id).catch(() => null);
        if (!cancelled) {
          hydrateProfileForm(establishment);
          setSubscription(sub);
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleInitializeProfile = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const establishment: EstablishmentProfile | null =
        ctxVenue ?? (previewMode ? await ensureStubEstablishmentForPro(userId) : null);

      if (!establishment) {
        Alert.alert("Initialisation impossible", "La fiche n'a pas pu etre preparee pour le moment.");
        return;
      }

      hydrateProfileForm(establishment);
      setSubscription(ctxSubscription ?? null);
    } catch {
      Alert.alert("Initialisation impossible", "La fiche n'a pas pu etre preparee pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const currentOfferKey = useMemo(() => {
    const requestedOffer = session?.user?.user_metadata?.requested_offer;
    return resolveOfferKey({
      requestedOffer: typeof requestedOffer === "string" ? requestedOffer : null,
      legacyPlan: subscription?.plan ?? null,
    });
  }, [session?.user?.user_metadata?.requested_offer, subscription?.plan]);

  const currentOffer = useMemo(() => getOfferByKey(currentOfferKey), [currentOfferKey]);
  const tagLimit = TAG_LIMIT_BY_OFFER[currentOfferKey];
  const hydrateProfileForm = (establishment: EstablishmentProfile) => {
    setProfile(establishment);
    setForm({
      name: establishment?.name ?? "",
      city: establishment?.city ?? "",
      address: establishment?.address ?? "",
      postcode: establishment?.postcode ?? "",
      description: establishment?.description ?? "",
      social_platform:
        establishment?.social_platform === "facebook" ? "facebook" : "instagram",
      social_url: establishment?.social_url ?? establishment?.instagram_url ?? "",
      website_url: establishment?.website_url ?? "",
      phone: establishment?.phone ?? "",
      lat: establishment?.lat != null ? String(establishment.lat) : "",
      lng: establishment?.lng != null ? String(establishment.lng) : "",
      darts_targets_count:
        establishment?.darts_targets_count != null
          ? String(establishment.darts_targets_count)
          : "",
      timezone: establishment?.timezone ?? "Europe/Paris",
      activities: Array.isArray(establishment?.activities)
        ? establishment.activities.filter(Boolean)
        : [],
      tags: Array.isArray(establishment?.tags) ? establishment.tags.filter(Boolean) : [],
      venue_type: establishment?.venue_type ?? "",
      venue_ambiance: Array.isArray(establishment?.venue_ambiance) ? establishment.venue_ambiance.filter(Boolean) : [],
      service_tags: Array.isArray(establishment?.service_tags) ? establishment.service_tags.filter(Boolean) : [],
      pin_emoji: establishment?.pin_emoji ?? "",
      opening_hours: slotsFromOpeningHours(establishment?.opening_hours ?? null),
    });
  };

  useEffect(() => {
    const term = placeQuery.trim();
    if (term.length < 3) {
      setPlaceLoading(false);
      setPlaceResults([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setPlaceLoading(true);
      try {
        const results = await searchPlaces(term, 6, controller.signal);
        if (!cancelled) {
          const unique = Array.from(
            new Map(
              results.map((item) => [
                (item.display_name || item.label || item.place_id || "")
                  .trim()
                  .toLowerCase(),
                item,
              ])
            ).values()
          );
          setPlaceResults(unique);
        }
      } catch {
        if (!cancelled) setPlaceResults([]);
      } finally {
        if (!cancelled) setPlaceLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [placeQuery]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  const completedFields = useMemo(() => {
    const checks = [
      Boolean(form.name.trim()),
      Boolean(form.address.trim() && form.city.trim()),
      Boolean(form.postcode.trim()),
      Boolean(form.description.trim()),
      Boolean(form.phone.trim() || form.website_url.trim() || form.social_url.trim()),
      form.activities.length > 0,
      Boolean(
        parseCoordinate(form.lat, -90, 90) != null && parseCoordinate(form.lng, -180, 180) != null
      ),
      form.tags.length > 0,
      Object.keys(normalizeOpeningHours(form.opening_hours)).length > 0,
    ];
    return checks.filter(Boolean).length;
  }, [form]);

  const mergedForFicheCheck = useMemo((): EstablishmentProfile | null => {
    if (!profile) return null;
    return {
      ...profile,
      name: form.name.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      postcode: form.postcode.trim() || null,
      description: form.description.trim() || null,
      instagram_url: form.social_platform === "instagram" ? form.social_url.trim() || null : null,
      website_url: form.website_url.trim() || null,
      phone: form.phone.trim() || null,
      contact: form.phone.trim() || null,
      activities: form.activities,
      darts_targets_count: form.darts_targets_count.trim()
        ? Number(form.darts_targets_count.trim())
        : null,
      social_platform: form.social_url.trim() ? form.social_platform : null,
      social_url: form.social_url.trim() || null,
      lat: parseCoordinate(form.lat, -90, 90),
      lng: parseCoordinate(form.lng, -180, 180),
      tags: form.tags,
      opening_hours: normalizeOpeningHours(form.opening_hours) as EstablishmentProfile["opening_hours"],
    };
  }, [profile, form]);

  const ficheComplete = useMemo(
    () => isEstablishmentFicheComplete(mergedForFicheCheck),
    [mergedForFicheCheck]
  );

  const selectedDayLabel = useMemo(
    () => dayOptions.find((day) => day.key === selectedDay)?.label ?? selectedDay,
    [dayOptions, selectedDay]
  );

  const openTimePicker = (day: DayKey, slotIndex: number, field: "open" | "close") => {
    setTimePicker({ day, slotIndex, field });
    setTimePickerVisible(true);
  };

  const applyTimeSelection = (value: string) => {
    if (!timePicker) return;
    const { day, slotIndex, field } = timePicker;
    setForm((prev) => {
      const nextDays = { ...prev.opening_hours };
      const daySlots = [...(nextDays[day] ?? [])];
      const slot = { ...daySlots[slotIndex], [field]: value };
      daySlots[slotIndex] = slot;
      nextDays[day] = daySlots;
      return { ...prev, opening_hours: nextDays };
    });
    setTimePickerVisible(false);
    setTimePicker(null);
  };

  const clearSlot = (day: DayKey, slotIndex: number) => {
    setForm((prev) => {
      const nextDays = { ...prev.opening_hours };
      const daySlots = [...(nextDays[day] ?? [])];
      daySlots[slotIndex] = { open: "", close: "" };
      nextDays[day] = daySlots;
      return { ...prev, opening_hours: nextDays };
    });
  };

  const addTag = (rawValue: string) => {
    const nextTag = normalizeTagValue(rawValue);
    if (!nextTag) return;

    const alreadyExists = form.tags.some(
      (tag) => normalizeTagValue(tag).toLowerCase() === nextTag.toLowerCase()
    );
    if (alreadyExists) {
      setTagInput("");
      return;
    }
    if (form.tags.length >= tagLimit) {
      Alert.alert(
        "Limite atteinte",
        `Ton offre ${currentOffer?.name ?? ""} permet jusqu'a ${tagLimit} tags.`
      );
      return;
    }

    setForm((prev) => ({ ...prev, tags: [...prev.tags, nextTag] }));
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const addActivity = (rawValue: string) => {
    const nextActivity = normalizeTagValue(rawValue);
    if (!nextActivity) return;

    const alreadyExists = form.activities.some(
      (activity) => normalizeTagValue(activity).toLowerCase() === nextActivity.toLowerCase()
    );
    if (alreadyExists) {
      setActivityInput("");
      return;
    }

    setForm((prev) => ({ ...prev, activities: [...prev.activities, nextActivity] }));
    setActivityInput("");
  };

  const removeActivity = (activityToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      activities: prev.activities.filter((activity) => activity !== activityToRemove),
    }));
  };

  const applyPlaceSuggestion = (place: PlaceResult) => {
    const nextAddress =
      place.address_line ||
      place.display_name?.split(",").slice(0, 2).join(", ").trim() ||
      form.address;
    const nextCity = place.city || form.city;
    const nextPostcode = place.postcode || form.postcode;

    setForm((prev) => ({
      ...prev,
      address: nextAddress,
      city: nextCity,
      postcode: nextPostcode,
      lat: place.lat != null ? String(place.lat) : prev.lat,
      lng: place.lon != null ? String(place.lon) : prev.lng,
    }));
    setPlaceQuery(
      place.display_name ||
        [nextAddress, nextPostcode, nextCity].filter(Boolean).join(", ")
    );
    setPlaceLoading(false);
    setPlaceResults([]);
  };

  const handleAutofillCoordinates = async () => {
    const query =
      placeQuery.trim() ||
      [form.address.trim(), form.postcode.trim(), form.city.trim()].filter(Boolean).join(" ");

    if (!query) {
      Alert.alert("Adresse manquante", "Renseigne l'adresse avant de calculer les coordonnees.");
      return;
    }

    try {
      setGeocoding(true);
      const results = await searchPlaces(query, 1);
      const bestMatch = results[0];
      if (!bestMatch || bestMatch.lat == null || bestMatch.lon == null) {
        Alert.alert("Aucun resultat", "Impossible de retrouver des coordonnees pour cette adresse.");
        return;
      }
      setForm((prev) => ({
        ...prev,
        lat: String(bestMatch.lat),
        lng: String(bestMatch.lon),
      }));
    } catch {
      Alert.alert("Erreur", "Impossible de calculer les coordonnees pour le moment.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    const lat = parseCoordinate(form.lat, -90, 90);
    const lng = parseCoordinate(form.lng, -180, 180);
    const hasLatInput = Boolean(form.lat.trim());
    const hasLngInput = Boolean(form.lng.trim());
    const dartsTargetsCount = form.darts_targets_count.trim();
    const parsedDartsTargetsCount = dartsTargetsCount ? Number(dartsTargetsCount) : null;

    if ((hasLatInput || hasLngInput) && (lat == null || lng == null)) {
      Alert.alert(
        "Coordonnees invalides",
        "Renseigne une latitude entre -90 et 90 et une longitude entre -180 et 180."
      );
      return;
    }
    if (
      parsedDartsTargetsCount != null &&
      (!Number.isInteger(parsedDartsTargetsCount) || parsedDartsTargetsCount < 0)
    ) {
      Alert.alert(
        "Nombre de cibles invalide",
        "Renseigne un nombre entier positif pour les cibles de flechettes."
      );
      return;
    }

    setSaving(true);
    setSaveStatus("idle");
    try {
      const updated = await updateMyEstablishment(profile.id, {
        name: form.name.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        postcode: form.postcode.trim() || null,
        description: form.description.trim() || null,
        instagram_url: form.social_platform === "instagram" ? form.social_url.trim() || null : null,
        website_url: form.website_url.trim() || null,
        phone: form.phone.trim() || null,
        contact: form.phone.trim() || null,
        activities: form.activities,
        darts_targets_count: parsedDartsTargetsCount,
        social_platform: form.social_url.trim() ? form.social_platform : null,
        social_url: form.social_url.trim() || null,
        timezone: form.timezone.trim() || null,
        tags: form.tags,
        venue_type: form.venue_type || null,
        venue_ambiance: form.venue_ambiance.length > 0 ? form.venue_ambiance : null,
        service_tags: form.service_tags.length > 0 ? form.service_tags : null,
        pin_emoji: form.pin_emoji || null,
        lat,
        lng,
        opening_hours: normalizeOpeningHours(form.opening_hours),
      });
      if (updated) setProfile(updated);
      setSaveStatus("saved");
      invalidateExploreCache();
      await refreshEstablishment();
      setSaveMessage({ type: "success", text: "Fiche mise à jour avec succès." });
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
      setSaveMessage({ type: "error", text: "Impossible d'enregistrer. Vérifiez votre connexion." });
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.primaryButtonText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (!profile && !loading) {
    return (
      <JovialProShell
        currentPath={pathname}
        title="Ma fiche"
        navVariant="profile-only"
        subtitle="Le shell partenaire est pret. Il reste a initialiser la fiche de l'etablissement."
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Initialisation de la fiche</Text>
          <Text style={styles.cardHint}>
            Recharge cette page apres connexion, puis complete les informations du lieu. Une fois la fiche en place, les autres onglets du back-office resteront accessibles depuis le menu de gauche.
          </Text>
          <View style={styles.emptyActions}>
            <Pressable style={styles.primaryButton} onPress={handleInitializeProfile}>
              <Text style={styles.primaryButtonText}>Initialiser ma fiche</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.replace("/establishment/dashboard")}
            >
              <Text style={styles.secondaryButtonText}>Retour au dashboard</Text>
            </Pressable>
          </View>
        </View>
      </JovialProShell>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Ma fiche"
      navVariant="full"
      subtitle="Renseigne les informations essentielles de ton etablissement. Les photos, activites et evenements sont geres dans leurs onglets dedies."
      loading={loading}
      rightSlot={
        <View style={styles.progressCard}>
          <Text style={styles.progressValue}>
            {completedFields}/{PROFILE_COMPLETION_BLOCKS}
          </Text>
          <Text style={styles.progressLabel}>blocs completes</Text>
        </View>
      }
    >
      {/* Barre de progression */}
      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <View style={styles.progressHeaderLeft}>
            <Text style={styles.progressTitle}>
              {completedFields === PROFILE_COMPLETION_BLOCKS
                ? "✓ Fiche complète"
                : `${completedFields} / ${PROFILE_COMPLETION_BLOCKS} sections complétées`}
            </Text>
            <Text style={styles.progressSub}>
              {completedFields === PROFILE_COMPLETION_BLOCKS
                ? "Ton établissement est bien visible sur Jovial."
                : "Complete chaque section pour maximiser ta visibilité sur la carte Jovial."}
            </Text>
          </View>
          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </Pressable>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${(completedFields / PROFILE_COMPLETION_BLOCKS) * 100}%` as any }]} />
        </View>
      </View>

      {saveMessage && (
        <View style={[styles.saveBanner, saveMessage.type === "success" ? styles.saveBannerSuccess : styles.saveBannerError]}>
          <Ionicons
            name={saveMessage.type === "success" ? "checkmark-circle" : "alert-circle"}
            size={18}
            color={saveMessage.type === "success" ? "#1a7a4a" : "#b91c1c"}
          />
          <Text style={[styles.saveBannerText, saveMessage.type === "success" ? styles.saveBannerTextSuccess : styles.saveBannerTextError]}>
            {saveMessage.text}
          </Text>
        </View>
      )}

      <View style={styles.grid}>
        <View style={[styles.card, styles.gridCard]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>1</Text></View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.cardTitle}>Identité du lieu <Text style={styles.required}>*</Text></Text>
              <Text style={styles.cardHint}>Nom, adresse et description — les infos de base visibles par tous les utilisateurs Jovial.</Text>
            </View>
          </View>
          <TextInput
            value={placeQuery}
            onChangeText={setPlaceQuery}
            placeholder="Rechercher une adresse"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={styles.fieldHint}>
            Recherche gratuite via OpenStreetMap. En selectionnant une suggestion, l'adresse, le code postal, la ville et les coordonnees GPS sont pre-remplis.
          </Text>
          {placeLoading ? (
            <Text style={styles.addressSearchMeta}>Recherche d'adresses...</Text>
          ) : null}
          {placeResults.length > 0 ? (
            <View style={styles.addressSuggestions}>
              {placeResults.map((place) => (
                <Pressable
                  key={place.place_id}
                  style={styles.addressSuggestionRow}
                  onPress={() => applyPlaceSuggestion(place)}
                >
                  <Text style={styles.addressSuggestionTitle}>
                    {place.display_name || place.address_line || place.label}
                  </Text>
                  <Text style={styles.addressSuggestionText}>
                    {[place.address_line, place.postcode, place.city]
                      .filter(Boolean)
                      .join(" - ") || place.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            value={form.name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="Nom du lieu"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
          />
          <TextInput
            value={form.city}
            onChangeText={(value) => setForm((prev) => ({ ...prev, city: value }))}
            placeholder="Ville"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
          />
          <TextInput
            value={form.postcode}
            onChangeText={(value) => setForm((prev) => ({ ...prev, postcode: value }))}
            placeholder="Code postal"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            keyboardType="number-pad"
          />
          <TextInput
            value={form.address}
            onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
            placeholder="Adresse complete"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
          />
          <TextInput
            value={form.description}
            onChangeText={(value) => setForm((prev) => ({ ...prev, description: value.slice(0, 150) }))}
            placeholder="Description du lieu"
            placeholderTextColor={"#9CA3AF"}
            style={[styles.input, styles.textArea]}
            multiline
            maxLength={150}
          />
          <Text style={[styles.fieldHint, { textAlign: "right", color: form.description.length >= 130 ? "#F59E0B" : "#9CA3AF" }]}>
            {form.description.length}/150 caractères
          </Text>
        </View>

        <View style={[styles.card, styles.gridCard]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>2</Text></View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.cardTitle}>Coordonnées <Text style={styles.required}>*</Text></Text>
              <Text style={styles.cardHint}>Téléphone, site web et réseaux sociaux — pour que les clients puissent te contacter directement.</Text>
            </View>
          </View>
          <TextInput
            value={form.phone}
            onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            placeholder="Telephone"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
          />
          <TextInput
            value={form.website_url}
            onChangeText={(value) => setForm((prev) => ({ ...prev, website_url: value }))}
            placeholder="Site web"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            autoCapitalize="none"
          />
          <View style={styles.socialPlatformRow}>
            <Pressable
              style={[styles.socialPlatformBtn, form.social_platform === "instagram" && styles.socialPlatformBtnActive]}
              onPress={() => setForm((prev) => ({ ...prev, social_platform: "instagram" }))}
            >
              <Ionicons name="logo-instagram" size={16} color={form.social_platform === "instagram" ? "#FFFFFF" : "#9CA3AF"} />
              <Text style={[styles.socialPlatformBtnText, form.social_platform === "instagram" && styles.socialPlatformBtnTextActive]}>
                Instagram
              </Text>
            </Pressable>
            <Pressable
              style={[styles.socialPlatformBtn, form.social_platform === "facebook" && styles.socialPlatformBtnActive]}
              onPress={() => setForm((prev) => ({ ...prev, social_platform: "facebook" }))}
            >
              <Ionicons name="logo-facebook" size={16} color={form.social_platform === "facebook" ? "#FFFFFF" : "#9CA3AF"} />
              <Text style={[styles.socialPlatformBtnText, form.social_platform === "facebook" && styles.socialPlatformBtnTextActive]}>
                Facebook
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={form.social_url}
            onChangeText={(value) => setForm((prev) => ({ ...prev, social_url: value }))}
            placeholder={form.social_platform === "instagram" ? "https://instagram.com/monbar" : "https://facebook.com/monbar"}
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextInput
            value={form.timezone}
            editable={false}
            pointerEvents="none"
            placeholder="Fuseau horaire"
            placeholderTextColor={"#9CA3AF"}
            style={[styles.input, styles.inputDisabled]}
          />
          <Pressable
            style={styles.selectButton}
            onPress={() => setTimezonePickerVisible(true)}
          >
            <Text style={styles.selectButtonLabel}>Choisir un fuseau horaire</Text>
            <Text style={styles.selectButtonValue}>{form.timezone || "Europe/Paris"}</Text>
          </Pressable>
          <Text style={styles.fieldHint}>
            Le numero de telephone servira aussi de contact rapide sur la fiche publique.
          </Text>
        </View>
      </View>


      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>3</Text></View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.cardTitle}>Type de lieu <Text style={styles.required}>*</Text></Text>
            <Text style={styles.cardHint}>Sélectionne le type qui décrit le mieux ton établissement — il apparaît sur ta fiche et aide les utilisateurs à te trouver dans les bons filtres.</Text>
          </View>
        </View>
        <PickerField
          value={form.venue_type}
          onChange={(v) => setForm((prev) => ({ ...prev, venue_type: v }))}
          groups={VENUE_TYPE_PICKER_GROUPS}
          placeholder="Choisir un type de lieu…"
          modalTitle="Type de lieu"
        />
      </View>

      {/* Emoji sur la carte */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>📍</Text></View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.cardTitle}>Emoji sur la carte</Text>
            <Text style={styles.cardHint}>Le « pin », c'est le petit repère rond qui marque ton établissement sur la carte Jovial. Choisis ici l'emoji affiché à l'intérieur — « Auto » prend automatiquement celui de ton activité principale.</Text>
          </View>
        </View>
        <PickerField
          value={form.pin_emoji}
          onChange={(v) => setForm((prev) => ({ ...prev, pin_emoji: v }))}
          options={PIN_EMOJI_OPTIONS}
          placeholder="Auto (selon l'activité principale)"
          modalTitle="Emoji du pin"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.tagHeader}>
          <View style={styles.tagHeaderText}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>4</Text></View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.cardTitle}>Ambiance</Text>
                <Text style={styles.cardHint}>Choisis jusqu'à {AMBIANCE_MAX} ambiances — elles aident les utilisateurs Jovial à trouver des lieux qui correspondent à leur humeur du moment.</Text>
              </View>
            </View>
          </View>
          <View style={styles.tagLimitCard}>
            <Text style={styles.tagLimitValue}>{form.venue_ambiance.length}/{AMBIANCE_MAX}</Text>
            <Text style={styles.tagLimitLabel}>ambiances</Text>
          </View>
        </View>
        <PickerField
          value={form.venue_ambiance}
          onChange={(v) => setForm((prev) => ({ ...prev, venue_ambiance: v }))}
          multi
          max={AMBIANCE_MAX}
          options={VENUE_AMBIANCE_PICKER}
          placeholder="Choisir des ambiances…"
          modalTitle="Ambiance"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.tagHeader}>
          <View style={styles.tagHeaderText}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>5</Text></View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.cardTitle}>Services & équipements</Text>
                <Text style={styles.cardHint}>Choisis jusqu'à {SERVICE_TAGS_MAX} services disponibles — terrasse, Wi-Fi, réservation... autant d'éléments qui influencent le choix d'un utilisateur.</Text>
              </View>
            </View>
          </View>
          <View style={styles.tagLimitCard}>
            <Text style={styles.tagLimitValue}>{form.service_tags.length}/{SERVICE_TAGS_MAX}</Text>
            <Text style={styles.tagLimitLabel}>services</Text>
          </View>
        </View>
        <PickerField
          value={form.service_tags}
          onChange={(v) => setForm((prev) => ({ ...prev, service_tags: v }))}
          multi
          max={SERVICE_TAGS_MAX}
          options={SERVICE_TAGS_PICKER}
          placeholder="Choisir des services…"
          modalTitle="Services & équipements"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>6</Text></View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.cardTitle}>Horaires d'ouverture <Text style={styles.required}>*</Text></Text>
            <Text style={styles.cardHint}>Définis jusqu'à 3 créneaux par jour. Laisse vide si l'établissement est fermé ce jour-là. Pour une fermeture après minuit, choisis simplement une heure de fermeture inférieure à l'heure d'ouverture (ex: 18:00 → 03:00).</Text>
          </View>
        </View>

        <View style={styles.daysTabs}>
          {dayOptions.map((day) => {
            const active = day.key === selectedDay;
            const hasHours = form.opening_hours[day.key].some((slot) => slot.open && slot.close);
            return (
              <Pressable
                key={day.key}
                onPress={() => setSelectedDay(day.key)}
                style={[styles.dayTab, active ? styles.dayTabActive : null]}
              >
                <Text style={[styles.dayTabText, active ? styles.dayTabTextActive : null]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayTabMeta, active ? styles.dayTabMetaActive : null]}>
                  {hasHours ? "Renseigne" : "Ferme"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.activeDayCard}>
          <View style={styles.activeDayHeader}>
            <Text style={styles.activeDayTitle}>{selectedDayLabel}</Text>
            <Text style={styles.activeDaySubtitle}>
              {form.opening_hours[selectedDay].some((slot) => slot.open && slot.close)
                ? "Horaires configures pour ce jour"
                : "Aucun horaire renseigne pour ce jour"}
            </Text>
          </View>

          <View style={styles.hoursSlots}>
            {form.opening_hours[selectedDay].map((slot, index) => (
              <View key={`${selectedDay}-${index}`} style={styles.hoursSlot}>
                <Pressable
                  style={styles.hoursPicker}
                  onPress={() => openTimePicker(selectedDay, index, "open")}
                >
                  <Text style={styles.hoursPickerText}>{slot.open || "Ouverture"}</Text>
                </Pressable>
                <Text style={styles.hoursSeparator}>-</Text>
                <Pressable
                  style={styles.hoursPicker}
                  onPress={() => openTimePicker(selectedDay, index, "close")}
                >
                  <Text style={styles.hoursPickerText}>
                    {slot.close
                      ? formatDisplayedTime(slot.close, "close", slot.open)
                      : "Fermeture"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.hoursClear}
                  onPress={() => clearSlot(selectedDay, index)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={"#9CA3AF"} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </View>

      {saveMessage && (
        <View style={[styles.saveBanner, saveMessage.type === "success" ? styles.saveBannerSuccess : styles.saveBannerError]}>
          <Ionicons
            name={saveMessage.type === "success" ? "checkmark-circle" : "alert-circle"}
            size={18}
            color={saveMessage.type === "success" ? "#1a7a4a" : "#b91c1c"}
          />
          <Text style={[styles.saveBannerText, saveMessage.type === "success" ? styles.saveBannerTextSuccess : styles.saveBannerTextError]}>
            {saveMessage.text}
          </Text>
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footerStatus}>Pense à enregistrer après chaque modification.</Text>
        <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Enregistrer</Text>}
        </Pressable>
      </View>

      <Modal visible={timePickerVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setTimePickerVisible(false);
            setTimePicker(null);
          }}
        >
          <View style={styles.timePickerCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.timePickerTitle}>Choisir une heure</Text>
            <ScrollView contentContainerStyle={styles.timePickerList}>
              <Pressable style={styles.timePickerOption} onPress={() => applyTimeSelection("")}>
                <Text style={styles.timePickerOptionText}>Aucun</Text>
              </Pressable>
              {(() => {
                const isClose = timePicker?.field === "close";
                const openVal = timePicker ? form.opening_hours[timePicker.day][timePicker.slotIndex]?.open : null;
                const openMins = toMinutes(openVal) ?? 0;
                const sorted = isClose
                  ? [
                      ...timeOptions.filter((t) => (toMinutes(t) ?? 0) > openMins),
                      ...timeOptions.filter((t) => (toMinutes(t) ?? 0) <= openMins),
                    ]
                  : timeOptions;
                return sorted.map((time) => (
                  <Pressable
                    key={time}
                    style={styles.timePickerOption}
                    onPress={() => applyTimeSelection(time)}
                  >
                    <Text style={styles.timePickerOptionText}>
                      {formatDisplayedTime(time, timePicker?.field ?? "open", openVal)}
                    </Text>
                  </Pressable>
                ));
              })()}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={timezonePickerVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setTimezonePickerVisible(false)}
        >
          <View style={styles.timePickerCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.timePickerTitle}>Choisir un fuseau horaire</Text>
            <ScrollView contentContainerStyle={styles.timePickerList}>
              {TIMEZONE_OPTIONS.map((timezone) => {
                const active = timezone === form.timezone;
                return (
                  <Pressable
                    key={timezone}
                    style={[
                      styles.timePickerOption,
                      active ? styles.timePickerOptionActive : null,
                    ]}
                    onPress={() => {
                      setForm((prev) => ({ ...prev, timezone }));
                      setTimezonePickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.timePickerOptionText,
                        active ? styles.timePickerOptionTextActive : null,
                      ]}
                    >
                      {timezone}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    gap: 12,
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  progressCard: {
    minWidth: 124,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    gap: 2,
  },
  progressValue: { color: "#111827", fontSize: 24, fontWeight: "800" },
  progressLabel: { color: "#9CA3AF", fontSize: 11, fontWeight: "700", textAlign: "center" },
  progressMeta: { color: "#111827", fontSize: 11, fontWeight: "800", textAlign: "center" },
  // Barre de progression
  progressBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 12,
  },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  progressHeaderLeft: { flex: 1, gap: 4, minWidth: 200 },
  progressTitle: { color: "#111827", fontSize: 16, fontWeight: "800" },
  progressSub: { color: "#6B7280", fontSize: 13, lineHeight: 18 },
  progressBarTrack: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 99, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#5CB6AC", borderRadius: 99 },
  saveBtn: { backgroundColor: "#2B4E93", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  // Numéros de section
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sectionHeaderText: { flex: 1, gap: 4 },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#5CB6AC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  sectionBadgeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  required: { color: "#5CB6AC", fontSize: 14 },
  grid: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 12,
  },
  gridCard: {
    minWidth: 320,
    flexGrow: 1,
    flexBasis: 320,
  },
  cardTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  cardHint: { color: "#9CA3AF", fontSize: 13, lineHeight: 19, marginBottom: 4 },
  fieldHint: { color: "#9CA3AF", fontSize: 12, lineHeight: 18 },
  addressSearchMeta: { color: "#111827", fontSize: 12, fontWeight: "700" },
  addressSuggestions: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  addressSuggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 4,
  },
  addressSuggestionTitle: { color: "#111827", fontSize: 13, fontWeight: "700" },
  addressSuggestionText: { color: "#9CA3AF", fontSize: 12, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    backgroundColor: "#F3F4F6",
  },
  inputDisabled: {
    color: "#9CA3AF",
  },
  coordInput: { minWidth: 180, flex: 1 },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  coordsRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  selectButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    gap: 4,
  },
  selectButtonLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  selectButtonValue: { color: "#111827", fontSize: 14, fontWeight: "700" },
  tagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  tagHeaderText: { gap: 4, flex: 1, minWidth: 220 },
  tagLimitCard: {
    minWidth: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
  },
  tagLimitValue: { color: "#111827", fontSize: 18, fontWeight: "800" },
  tagLimitLabel: { color: "#9CA3AF", fontSize: 11, fontWeight: "700", textAlign: "center" },
  tagInputRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" },
  tagInput: { flex: 1, minWidth: 220 },
  primaryButtonCompact: {
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 110,
  },
  suggestionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  suggestionChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  suggestionChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#2B4E93",
  },
  suggestionChipDisabled: { opacity: 0.45 },
  suggestionChipText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  suggestionChipTextActive: { color: "#111827" },
  venueTypeGroup: { gap: 8 },
  venueTypeGroupLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  venueTypeChipActive: {
    backgroundColor: "#2B4E93",
    borderColor: "#2B4E93",
  },
  venueTypeChipTextActive: { color: "#FFFFFF" },
  venueTypeSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#2B4E93",
  },
  venueTypeSelectedText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  tagChipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tagChipText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  daysTabs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dayTab: {
    minWidth: 108,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    gap: 2,
  },
  dayTabActive: {
    backgroundColor: "#2B4E93",
    borderColor: "#2B4E93",
  },
  dayTabText: { color: "#111827", fontSize: 13, fontWeight: "800" },
  dayTabTextActive: { color: "#FFFFFF" },
  dayTabMeta: { color: "#9CA3AF", fontSize: 11, fontWeight: "700" },
  dayTabMetaActive: { color: "rgba(255,255,255,0.8)" },
  activeDayCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    padding: 16,
    gap: 14,
  },
  activeDayHeader: { gap: 4 },
  activeDayTitle: { color: "#111827", fontSize: 18, fontWeight: "800" },
  activeDaySubtitle: { color: "#9CA3AF", fontSize: 13, lineHeight: 19 },
  hoursSlots: { gap: 8 },
  hoursSlot: { flexDirection: "row", alignItems: "center", gap: 8 },
  hoursPicker: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  hoursPickerText: { color: "#111827", fontSize: 13, fontWeight: "600" },
  hoursSeparator: { color: "#9CA3AF", fontSize: 14, fontWeight: "800" },
  hoursClear: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  emptyActions: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  footerStatus: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },
  socialPlatformRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  socialPlatformBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  socialPlatformBtnActive: { backgroundColor: "#2B4E93", borderColor: "#2B4E93" },
  socialPlatformBtnText: { fontSize: 13, fontWeight: "600", color: "#9CA3AF" },
  socialPlatformBtnTextActive: { color: "#FFFFFF" },
  saveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  saveBannerSuccess: { backgroundColor: "#d1fae5", borderWidth: 1, borderColor: "#6ee7b7" },
  saveBannerError: { backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fca5a5" },
  saveBannerText: { fontSize: 14, fontWeight: "600", flex: 1 },
  saveBannerTextSuccess: { color: "#1a7a4a" },
  saveBannerTextError: { color: "#b91c1c" },
  primaryButton: {
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 150,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryButtonText: { color: "#111827", fontSize: 14, fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  timePickerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    maxHeight: "70%",
  },
  timePickerTitle: { color: "#111827", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  timePickerList: { gap: 6 },
  timePickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  timePickerOptionActive: {
    backgroundColor: "#F3F4F6",
    borderColor: "#111827",
  },
  timePickerOptionText: { color: "#111827", fontWeight: "600" },
  timePickerOptionTextActive: { color: "#111827", fontWeight: "800" },
});
