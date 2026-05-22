import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import JovialProShell from "@/components/ui/JovialProShell";
import {
  formatOfferPrice,
  getOfferByKey,
} from "@/constants/jovialPro";
import { useAuth } from "@/providers/AuthProvider";
import { useEstablishment } from "@/providers/EstablishmentProvider";
import { fetchVenueBookingActivities } from "@/services/bookings";
import { listMyEvents } from "@/services/establishment";
import { supabase } from "@/services/supabase";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

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
          const [events, activitiesResult, reservationsResult] = await Promise.all([
            listMyEvents(venue.id).catch(() => []),
            fetchVenueBookingActivities(venue.id).catch(() => []),
            supabase
              .from("reservations")
              .select("id", { count: "exact", head: true })
              .eq("venue_id", venue.id)
              .gte("starts_at", new Date().toISOString()),
          ]);
          if (!cancelled) {
            setEventsCount(events.length);
            setActivitiesCount(activitiesResult.length);
            setReservationsCount(reservationsResult.count ?? 0);
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
      const [events, activitiesResult, reservationsResult] = await Promise.all([
        listMyEvents(venue.id).catch(() => []),
        fetchVenueBookingActivities(venue.id).catch(() => []),
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", venue.id)
          .gte("starts_at", new Date().toISOString()),
      ]);
      setEventsCount(events.length);
      setActivitiesCount(activitiesResult.length);
      setReservationsCount(reservationsResult.count ?? 0);
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
      venue.instagram_url,
      venue.website_url,
      venue.phone,
    ];
    const filled = fields.filter((value) => Boolean(String(value ?? "").trim())).length;
    return Math.round((filled / fields.length) * 100);
  }, [venue]);

  const currentOffer = useMemo(() => {
    if (!subscription || subscription.status !== "active") return null;
    return getOfferByKey(subscription.plan);
  }, [subscription]);

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
      subtitle={`Bonjour ${venue?.name ?? "partenaire"}, voici les points prioritaires de ton espace.`}
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
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Fiche complète</Text>
          <Text style={styles.metricValue}>{completion}%</Text>
          <Text style={styles.metricText}>Description, contact, visuel et réseaux.</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Activités</Text>
          <Text style={styles.metricValue}>{activitiesCount}</Text>
          <Text style={styles.metricText}>Activités actuellement visibles sur la fiche.</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Événements</Text>
          <Text style={styles.metricValue}>{eventsCount}</Text>
          <Text style={styles.metricText}>Programmation publiée ou en brouillon.</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Réservations à venir</Text>
          <Text style={styles.metricValue}>{reservationsCount}</Text>
          <Text style={styles.metricText}>Demandes clients déjà enregistrées.</Text>
        </View>
      </View>

      <View style={styles.twoColumns}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Raccourcis</Text>
          <View style={styles.actionList}>
            <Pressable style={styles.primaryButton} onPress={() => router.push("/establishment/events/new")}>
              <Text style={styles.primaryButtonText}>Ajouter un événement</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push("/establishment/profile")}>
              <Text style={styles.secondaryButtonText}>Mettre à jour ma fiche</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push("/establishment/photos")}>
              <Text style={styles.secondaryButtonText}>Gérer mes photos</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push("/establishment/reservations")}>
              <Text style={styles.secondaryButtonText}>Voir les réservations</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push("/establishment/boosts")}>
              <Text style={styles.secondaryButtonText}>📅 Gérer mes boosts</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push("/establishment/blackouts")}>
              <Text style={styles.secondaryButtonText}>🚫 Fermetures & blocages</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Mon offre</Text>
          {currentOffer ? (
            <>
              <Text style={styles.offerTitle}>{currentOffer.name}</Text>
              <Text style={styles.offerSummary}>{currentOffer.summary}</Text>
              <View style={styles.featureList}>
                {currentOffer.features.slice(0, 3).map((feature) => (
                  <Text key={feature} style={styles.featureText}>
                    • {feature}
                  </Text>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.offerSummary}>Aucune offre identifiée pour le moment.</Text>
          )}
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/establishment/subscription")}>
            <Text style={styles.secondaryButtonText}>Voir les offres supérieures</Text>
          </Pressable>
        </View>
      </View>
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
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
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
  metricText: { color: Pastel.textMuted, fontSize: 13, lineHeight: 19, fontFamily: Font.regular, includeFontPadding: false },
  twoColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  panel: {
    minWidth: 280,
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: Pastel.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 20,
    gap: 14,
  },
  panelTitle: { color: Pastel.text, fontSize: 20, fontFamily: Font.extraBold, includeFontPadding: false },
  actionList: { gap: 10 },
  offerTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  offerSummary: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },
  featureList: { gap: 6 },
  featureText: { color: Pastel.text, fontSize: 13, lineHeight: 18, fontFamily: Font.regular, includeFontPadding: false },
  primaryButton: {
    backgroundColor: Pastel.orange,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  secondaryButton: {
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: { color: Pastel.text, fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
});
