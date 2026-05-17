import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";
import {
  PERK_FREQUENCY_LABELS,
  VenuePerk,
  checkPerkAvailability,
  fetchActiveVenuePerks,
  redeemAndValidatePerk,
} from "@/services/perks";

function formatNextAvailable(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function useTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return tick;
}

export default function PerkRedeemScreen() {
  const { id } = useLocalSearchParams<{ id: string; venueId: string }>();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const tick = useTicker();

  const perkId = Number(id);
  const venueIdNum = Number(venueId);

  const [loading, setLoading] = useState(true);
  const [perk, setPerk] = useState<VenuePerk | null>(null);
  const [available, setAvailable] = useState(false);
  const [nextAvailableAt, setNextAvailableAt] = useState<Date | null>(null);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activatedAt] = useState(() => new Date());

  useEffect(() => {
    if (!userId || !Number.isFinite(perkId) || !Number.isFinite(venueIdNum)) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const perks = await fetchActiveVenuePerks(venueIdNum);
        const found = perks.find((p) => p.id === perkId) ?? null;
        if (!found) {
          if (!cancelled) { setPerk(null); setLoading(false); }
          return;
        }
        const avail = await checkPerkAvailability(perkId, userId, found.frequency);
        if (!cancelled) {
          setPerk(found);
          setAvailable(avail.available);
          setNextAvailableAt(avail.nextAvailableAt);
        }
      } catch {
        if (!cancelled) setError("Impossible de charger cet avantage.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [perkId, venueIdNum, userId]);

  const elapsed = useMemo(() => {
    const seconds = Math.floor((Date.now() - activatedAt.getTime()) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [activatedAt, tick]);

  const handleValidate = async () => {
    if (!perk || !userId) return;
    setValidating(true);
    setError(null);
    try {
      await redeemAndValidatePerk(perkId, venueIdNum, userId);
      setValidated(true);
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Validation impossible. Réessaie.";
      setError(message);
    } finally {
      setValidating(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🔒</Text>
          <Text style={styles.heading}>Connexion requise</Text>
          <Text style={styles.sub}>Tu dois être connecté pour utiliser cet avantage.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.primaryButtonText}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={"#111827"} size="large" />
        </View>
      </View>
    );
  }

  if (!perk || !Number.isFinite(perkId) || !Number.isFinite(venueIdNum)) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>😕</Text>
          <Text style={styles.heading}>Avantage introuvable</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.primaryButtonText}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!available && nextAvailableAt) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>⏳</Text>
          <Text style={styles.heading}>Déjà utilisé</Text>
          <Text style={styles.sub}>
            Tu pourras réutiliser cet avantage à partir du{"\n"}
            <Text style={styles.subBold}>{formatNextAvailable(nextAvailableAt)}</Text>
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.secondaryButtonText}>Retour à la fiche</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (validated) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.bigEmojiSuccess}>✅</Text>
          <Text style={styles.headingSuccess}>Avantage validé !</Text>
          <Text style={styles.sub}>
            Profite de ton avantage :{"\n"}
            <Text style={styles.subBold}>{perk.title}</Text>
          </Text>
          <Text style={styles.frequencyNote}>
            Prochain disponible dans {PERK_FREQUENCY_LABELS[perk.frequency].replace("1 fois ", "")}
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.primaryButtonText}>Retour à la fiche</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.backBtnText}>✕ Annuler</Text>
      </Pressable>

      <View style={styles.center}>
        <View style={styles.perkCard}>
          <Text style={styles.perkEmoji}>✨</Text>
          <Text style={styles.perkTitle}>{perk.title}</Text>
          {perk.description ? (
            <Text style={styles.perkDescription}>{perk.description}</Text>
          ) : null}
          <View style={styles.frequencyPill}>
            <Text style={styles.frequencyPillText}>{PERK_FREQUENCY_LABELS[perk.frequency]}</Text>
          </View>
        </View>

        <View style={styles.timerBlock}>
          <Text style={styles.timerLabel}>Activé depuis</Text>
          <Text style={styles.timerValue}>{elapsed}</Text>
        </View>

        <Text style={styles.instruction}>
          Remets ton téléphone à l'employé{"\n"}et demande-lui de valider ci-dessous.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.validateButton, validating ? styles.validateButtonDisabled : null]}
          onPress={handleValidate}
          disabled={validating}
          hitSlop={8}
        >
          {validating ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <>
              <Text style={styles.validateButtonEmoji}>👆</Text>
              <Text style={styles.validateButtonText}>Valider la remise</Text>
              <Text style={styles.validateButtonSub}>Réservé à l'employé de l'établissement</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  backBtn: {
    position: "absolute",
    top: 56,
    left: 20,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backBtnText: { color: "#111827", fontSize: 13, fontWeight: "700", includeFontPadding: false },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 20,
  },
  bigEmoji: { fontSize: 56, includeFontPadding: false },
  bigEmojiSuccess: { fontSize: 72, includeFontPadding: false },
  heading: { color: "#111827", fontSize: 26, fontWeight: "800", textAlign: "center", includeFontPadding: false },
  headingSuccess: { color: "#059669", fontSize: 28, fontWeight: "800", textAlign: "center", includeFontPadding: false },
  sub: { color: "#9CA3AF", fontSize: 15, lineHeight: 22, textAlign: "center", includeFontPadding: false },
  subBold: { color: "#111827", fontWeight: "700" },
  frequencyNote: { color: "#9CA3AF", fontSize: 13, textAlign: "center", includeFontPadding: false },
  perkCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 28,
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  perkEmoji: { fontSize: 52, includeFontPadding: false },
  perkTypeLabel: { color: "#9CA3AF", fontSize: 13, fontWeight: "700", letterSpacing: 0.5, includeFontPadding: false },
  perkTitle: { color: "#111827", fontSize: 22, fontWeight: "800", textAlign: "center", includeFontPadding: false },
  perkDescription: { color: "#9CA3AF", fontSize: 14, lineHeight: 20, textAlign: "center", includeFontPadding: false },
  frequencyPill: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 4,
  },
  frequencyPillText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700", includeFontPadding: false },
  timerBlock: { alignItems: "center", gap: 2 },
  timerLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "600", includeFontPadding: false },
  timerValue: { color: "#111827", fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"], includeFontPadding: false },
  instruction: {
    color: "#9CA3AF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    includeFontPadding: false,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    textAlign: "center",
    includeFontPadding: false,
  },
  validateButton: {
    backgroundColor: "#059669",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 6,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#059669",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  validateButtonDisabled: { opacity: 0.6 },
  validateButtonEmoji: { fontSize: 32, includeFontPadding: false },
  validateButtonText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", includeFontPadding: false },
  validateButtonSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", includeFontPadding: false },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", includeFontPadding: false },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryButtonText: { color: "#111827", fontSize: 15, fontWeight: "700", includeFontPadding: false },
});
