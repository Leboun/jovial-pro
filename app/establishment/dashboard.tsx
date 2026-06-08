import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import JovialProShell from "@/components/ui/JovialProShell";
import { formatOfferPrice, getOfferByKey } from "@/constants/jovialPro";
import { useAuth } from "@/providers/AuthProvider";
import { useEstablishment } from "@/providers/EstablishmentProvider";
import { fetchVenueBookingActivities } from "@/services/bookings";
import { listMyEvents, updateMyEstablishment } from "@/services/establishment";
import { fetchVenuePerks } from "@/services/perks";
import { supabase } from "@/services/supabase";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

// Checklist steps — order matters, first incomplete = recommended action
const ONBOARDING_STEPS = [
  { key: "profile", label: "Compléter les informations de ta fiche", route: "/establishment/profile" as const },
  { key: "photos", label: "Ajouter au moins 3 photos de ton établissement", route: "/establishment/photos" as const },
  { key: "activities", label: "Renseigner tes activités", route: "/establishment/activities" as const },
  { key: "perk", label: "Créer un avantage exclusif pour les membres Premium Jovial", route: "/establishment/perks" as const },
  { key: "event", label: "Publier ton premier événement", route: "/establishment/events/new" as const },
] as const;

type StepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export default function EstablishmentDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { venue, subscription, loading: estLoading, refresh: refreshEstablishment } = useEstablishment();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [reservationsCount, setReservationsCount] = useState(0);
  const [upcomingEvent, setUpcomingEvent] = useState<{ title: string; starts_at: string } | null>(null);
  const [hasActivePerk, setHasActivePerk] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    setNotes(venue?.pro_notes ?? "");
  }, [venue?.id]);

  const saveNotes = async () => {
    if (!venue) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await updateMyEstablishment(venue.id, { pro_notes: notes.trim() ? notes : null });
      setNotesSaved(true);
      refreshEstablishment?.();
    } catch {
      /* non bloquant */
    } finally {
      setSavingNotes(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!venue) return;
      if (subscription && subscription.status !== "active") {
        supabase.auth.getUser().then(({ data: userData }) => {
          const requestedOffer = userData.user?.user_metadata?.requested_offer ?? "rayonnement";
          router.replace(`/establishment/subscription/${requestedOffer}` as any);
        });
        return;
      }
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const [events, activitiesResult, reservationsResult, perks] = await Promise.all([
            listMyEvents(venue.id).catch(() => [] as any[]),
            fetchVenueBookingActivities(venue.id).catch(() => [] as any[]),
            supabase
              .from("reservations")
              .select("id", { count: "exact", head: true })
              .eq("venue_id", venue.id)
              .gte("starts_at", new Date().toISOString()),
            fetchVenuePerks(venue.id).catch(() => [] as any[]),
          ]);
          if (!cancelled) {
            setEventsCount(events.length);
            setActivitiesCount(activitiesResult.length);
            setReservationsCount(reservationsResult.count ?? 0);
            setHasActivePerk(perks.some((p: any) => p.is_active));
            const upcoming = events
              .filter((e: any) => e.starts_at && new Date(e.starts_at) > new Date())
              .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null;
            setUpcomingEvent(upcoming ? { title: upcoming.title, starts_at: upcoming.starts_at } : null);
          }
        } catch {
          // silently ignore
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [venue, subscription, router])
  );

  const handleRefresh = useCallback(async () => {
    if (!venue) return;
    setRefreshing(true);
    try {
      await refreshEstablishment();
      const [events, activitiesResult, reservationsResult, perks] = await Promise.all([
        listMyEvents(venue.id).catch(() => [] as any[]),
        fetchVenueBookingActivities(venue.id).catch(() => [] as any[]),
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", venue.id)
          .gte("starts_at", new Date().toISOString()),
        fetchVenuePerks(venue.id).catch(() => [] as any[]),
      ]);
      setEventsCount(events.length);
      setActivitiesCount(activitiesResult.length);
      setReservationsCount(reservationsResult.count ?? 0);
      setHasActivePerk(perks.some((p: any) => p.is_active));
      const upcoming = events
        .filter((e: any) => e.starts_at && new Date(e.starts_at) > new Date())
        .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null;
      setUpcomingEvent(upcoming ? { title: upcoming.title, starts_at: upcoming.starts_at } : null);
    } catch {
      // silently ignore
    } finally {
      setRefreshing(false);
    }
  }, [venue, refreshEstablishment]);

  const completion = useMemo(() => {
    if (!venue) return 0;
    const fields = [
      venue.name,
      venue.city,
      venue.address,
      venue.description,
      venue.cover_url,
      venue.phone,
    ];
    const filled = fields.filter((v) => Boolean(String(v ?? "").trim())).length;
    return Math.round((filled / fields.length) * 100);
  }, [venue]);

  const currentOffer = useMemo(() => {
    if (!subscription || subscription.status !== "active") return null;
    return getOfferByKey(subscription.plan);
  }, [subscription]);

  // Determine completed steps
  const completedSteps = useMemo((): Set<StepKey> => {
    const done = new Set<StepKey>();
    if (completion === 100) done.add("profile");
    const photosArray: string[] = (venue as any)?.photos ?? [];
    if (photosArray.length >= 3) done.add("photos");
    if (activitiesCount > 0) done.add("activities");
    if (hasActivePerk) done.add("perk");
    if (eventsCount > 0) done.add("event");
    return done;
  }, [completion, venue, activitiesCount, hasActivePerk, eventsCount]);

  const allDone = completedSteps.size === ONBOARDING_STEPS.length;

  // Recommended next action = first incomplete step
  const nextStep = useMemo(() =>
    ONBOARDING_STEPS.find((s) => !completedSteps.has(s.key)) ?? null,
    [completedSteps]
  );

  // Alerts: critical issues that need immediate attention
  const alerts = useMemo(() => {
    const list: { message: string; route: string; severity: "critical" | "warning" }[] = [];
    if (!hasActivePerk && activitiesCount >= 0 && !loading) {
      list.push({
        message: "Aucun avantage Premium configuré — ton établissement n'est pas mis en avant pour les utilisateurs Jovial Premium.",
        route: "/establishment/perks",
        severity: "critical",
      });
    }
    if (completion < 100 && !loading) {
      list.push({
        message: `Tes informations sont complètes à ${completion}% — une fiche incomplète réduit ta visibilité sur la carte Jovial.`,
        route: "/establishment/profile",
        severity: "warning",
      });
    }
    return list;
  }, [hasActivePerk, completion, activitiesCount, loading]);

  // Metric context helpers
  const eventContext = useMemo(() => {
    if (upcomingEvent) {
      const d = new Date(upcomingEvent.starts_at);
      const dateStr = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return `Prochain : ${upcomingEvent.title} le ${dateStr}`;
    }
    if (eventsCount === 0) return "Publie ton premier événement";
    return "Aucun événement à venir";
  }, [eventsCount, upcomingEvent]);

  const reservationContext = useMemo(() => {
    if (reservationsCount === 0) return "Active les réservations sur ta fiche";
    return `${reservationsCount} demande${reservationsCount > 1 ? "s" : ""} enregistrée${reservationsCount > 1 ? "s" : ""}`;
  }, [reservationsCount]);

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.button} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.buttonText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (!venue && !estLoading) {
    return (
      <JovialProShell
        currentPath={pathname}
        title="Dashboard"
        subtitle="Le shell partenaire est disponible. Il faut maintenant finaliser la fiche établissement pour alimenter les modules."
      >
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyPanelTitle}>Finaliser la fiche établissement</Text>
          <Text style={styles.emptyPanelText}>
            Renseigne les informations du lieu, puis tu retrouveras ici ton tableau de bord quotidien avec accès à la fiche, aux activités, aux photos et aux événements.
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace("/establishment/profile")}>
            <Text style={styles.buttonText}>Ouvrir ma fiche</Text>
          </Pressable>
        </View>
      </JovialProShell>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Dashboard"
      subtitle={`Bonjour, ${venue?.name ?? "partenaire"} — bienvenue dans ton espace Jovial Pro !`}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
      rightSlot={
        currentOffer ? (
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeEyebrow}>Offre active</Text>
            <Text style={styles.offerBadgeTitle}>{currentOffer.name}</Text>
            <Text style={styles.offerBadgeText}>{formatOfferPrice(currentOffer.annualPrice)}</Text>
          </View>
        ) : null
      }
    >
      {/* Alertes prioritaires */}
      {alerts.length > 0 && (
        <View style={styles.alertsContainer}>
          {alerts.map((alert) => (
            <Pressable
              key={alert.message}
              style={[styles.alertCard, alert.severity === "critical" ? styles.alertCritical : styles.alertWarning]}
              onPress={() => router.push(alert.route as any)}
            >
              <Text style={styles.alertIcon}>{alert.severity === "critical" ? "🔴" : "⚠️"}</Text>
              <View style={styles.alertBody}>
                <Text style={[styles.alertText, alert.severity === "critical" ? styles.alertTextCritical : styles.alertTextWarning]}>
                  {alert.message}
                </Text>
                <Text style={styles.alertCta}>
                  {alert.severity === "critical" ? "Configurer maintenant →" : "Compléter ma fiche →"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Métriques */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Fiche complète</Text>
          <Text style={[styles.metricValue, completion === 100 && styles.metricValueGreen]}>{completion}%</Text>
          <Text style={styles.metricText}>
            {completion === 100 ? "Tous les champs sont renseignés ✓" : "Nom, ville, adresse, description, photo, téléphone"}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Activités</Text>
          <Text style={styles.metricValue}>{activitiesCount}</Text>
          <Text style={styles.metricText}>
            {activitiesCount === 0 ? "Ajoute tes activités pour être trouvé" : `${activitiesCount} activité${activitiesCount > 1 ? "s" : ""} visible${activitiesCount > 1 ? "s" : ""} sur ta fiche`}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Événements</Text>
          <Text style={styles.metricValue}>{eventsCount}</Text>
          <Text style={styles.metricText}>{eventContext}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Réservations à venir</Text>
          <Text style={styles.metricValue}>{reservationsCount}</Text>
          <Text style={styles.metricText}>{reservationContext}</Text>
        </View>
      </View>

      {/* Checklist onboarding ou Bloc-notes */}
      {!allDone ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Mise en route</Text>
            <Text style={styles.panelSubtitle}>{completedSteps.size}/{ONBOARDING_STEPS.length} étapes complétées</Text>
          </View>

          {/* Barre de progression */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(completedSteps.size / ONBOARDING_STEPS.length) * 100}%` as any }]} />
          </View>

          {/* Action recommandée */}
          {nextStep && (
            <Pressable style={styles.nextActionCard} onPress={() => router.push(nextStep.route as any)}>
              <View style={styles.nextActionLeft}>
                <Text style={styles.nextActionEyebrow}>Prochaine action recommandée</Text>
                <Text style={styles.nextActionLabel}>{nextStep.label}</Text>
              </View>
              <Text style={styles.nextActionArrow}>→</Text>
            </Pressable>
          )}

          {/* Liste des étapes */}
          <View style={styles.stepList}>
            {ONBOARDING_STEPS.map((step) => {
              const done = completedSteps.has(step.key);
              return (
                <Pressable
                  key={step.key}
                  style={styles.stepRow}
                  onPress={() => !done && router.push(step.route as any)}
                >
                  <View style={[styles.stepDot, done ? styles.stepDotDone : styles.stepDotPending]}>
                    {done && <Text style={styles.stepCheck}>✓</Text>}
                  </View>
                  <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        /* Bloc-notes (visible une fois l'onboarding terminé) */
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Bloc-notes</Text>
            <Text style={styles.panelSubtitle}>Tes idées d'événements, d'activités...</Text>
          </View>
          <View style={styles.noteEditor}>
            <TextInput
              style={styles.noteInput}
              value={notes}
              onChangeText={(t) => { setNotes(t); setNotesSaved(false); }}
              placeholder="Écris tes idées d'événements, d'activités, ta to-do… tout ce que tu veux."
              placeholderTextColor={Pastel.textMuted}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.noteSaveBtn, savingNotes && { opacity: 0.6 }]}
              onPress={saveNotes}
              disabled={savingNotes}
            >
              <Text style={styles.noteSaveBtnText}>
                {savingNotes ? "Enregistrement…" : notesSaved ? "✓ Enregistré" : "Enregistrer"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Pastel.background,
    padding: 20,
  },
  title: { fontSize: 22, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  button: {
    backgroundColor: Pastel.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buttonText: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },
  emptyPanel: {
    backgroundColor: Pastel.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 22,
    gap: 12,
  },
  emptyPanelTitle: { color: Pastel.text, fontSize: 22, fontFamily: Font.extraBold, includeFontPadding: false },
  emptyPanelText: { color: Pastel.textMuted, fontSize: 14, lineHeight: 21, maxWidth: 760, fontFamily: Font.regular, includeFontPadding: false },
  offerBadge: {
    backgroundColor: Pastel.primary,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
    minWidth: 180,
  },
  offerBadgeEyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: Font.semiBold, includeFontPadding: false },
  offerBadgeTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  offerBadgeText: { color: Pastel.cream, fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },

  // Bloc d'accueil
  welcomeBlock: {
    backgroundColor: Pastel.surfaceSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  welcomeText: {
    fontSize: 20,
    fontFamily: Font.regular,
    color: Pastel.textMuted,
    lineHeight: 28,
    includeFontPadding: false,
  },
  welcomeName: {
    fontFamily: Font.extraBold,
    color: Pastel.primary,
    fontSize: 20,
  },

  // Alertes
  alertsContainer: { gap: 10 },
  alertCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  alertCritical: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  alertWarning: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  alertIcon: { fontSize: 16, lineHeight: 22 },
  alertBody: { flex: 1, gap: 4 },
  alertText: { fontSize: 13, lineHeight: 19, fontFamily: Font.regular, includeFontPadding: false },
  alertTextCritical: { color: "#991B1B" },
  alertTextWarning: { color: "#92400E" },
  alertCta: { fontSize: 12, fontFamily: Font.bold, color: Pastel.primary, includeFontPadding: false },

  // Métriques
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  metricCard: {
    minWidth: 220,
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: Pastel.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 18,
    gap: 6,
  },
  metricLabel: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  metricValue: { color: Pastel.primary, fontSize: 32, fontFamily: Font.display, includeFontPadding: false },
  metricValueGreen: { color: Pastel.success },
  metricText: { color: Pastel.textMuted, fontSize: 13, lineHeight: 19, fontFamily: Font.regular, includeFontPadding: false },

  // Panel générique
  panel: {
    backgroundColor: Pastel.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 20,
    gap: 16,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { color: Pastel.text, fontSize: 20, fontFamily: Font.extraBold, includeFontPadding: false },
  panelSubtitle: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },

  // Barre de progression
  progressBar: { height: 6, backgroundColor: Pastel.border, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Pastel.teal, borderRadius: 99 },

  // Action recommandée
  nextActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Pastel.tealSoft,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Pastel.teal,
  },
  nextActionLeft: { flex: 1, gap: 3 },
  nextActionEyebrow: { color: Pastel.teal, fontSize: 10, fontFamily: Font.bold, letterSpacing: 0.8, includeFontPadding: false },
  nextActionLabel: { color: Pastel.text, fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  nextActionArrow: { color: Pastel.teal, fontSize: 18, fontFamily: Font.bold },

  // Étapes checklist
  stepList: { gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  stepDotDone: { backgroundColor: Pastel.teal, borderColor: Pastel.teal },
  stepDotPending: { backgroundColor: "transparent", borderColor: Pastel.border },
  stepCheck: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.bold },
  stepLabel: { color: Pastel.text, fontSize: 14, fontFamily: Font.regular, includeFontPadding: false },
  stepLabelDone: { color: Pastel.textMuted, textDecorationLine: "line-through" },

  // Bloc-notes
  noteEmpty: {
    borderWidth: 1,
    borderColor: Pastel.border,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  noteEmptyText: { color: Pastel.textMuted, fontFamily: Font.semiBold, fontSize: 14, includeFontPadding: false },
  noteList: { gap: 8 },
  noteRow: {
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  noteText: { color: Pastel.text, fontSize: 14, fontFamily: Font.regular, includeFontPadding: false },
  noteAdd: { alignSelf: "flex-start", paddingVertical: 6 },
  noteAddText: { color: Pastel.teal, fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  noteEditor: { gap: 10 },
  noteInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    fontFamily: Font.regular,
    color: Pastel.text,
    backgroundColor: Pastel.surface,
  },
  noteSaveBtn: {
    alignSelf: "flex-start",
    backgroundColor: Pastel.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  noteSaveBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
});
