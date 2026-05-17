import { useCallback, useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";
import { getBackOfficeEstablishment, getSubscription } from "@/services/establishment";
import {
  bookCarouselDate,
  bookExploreDate,
  cancelBooking,
  getCarouselBookedDates,
  getExploreUnavailableDates,
  getMyCarouselBookings,
  getMyExploreBookings,
  type CarouselBooking,
  type ExploreBooking,
} from "@/services/boostBookings";
import { getPlanCapabilities } from "@/utils/planFeatureGate";
import JovialProShell from "@/components/ui/JovialProShell";
import { Pastel } from "@/constants/pastel";

const ORANGE = "#F97316";
const GREEN = Pastel.success;
const RED = Pastel.danger;

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateFR(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function getMondayOfWeek(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  const dow = (date.getDay() + 6) % 7; // 0=Lundi … 6=Dimanche
  const monday = new Date(date);
  monday.setDate(day - dow);
  return toDateStr(monday.getFullYear(), monday.getMonth(), monday.getDate());
}

function getMondayStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return getMondayOfWeek(d.getFullYear(), d.getMonth(), d.getDate());
}

function getWeekRangeFR(mondayStr: string): string {
  const monday = new Date(mondayStr + "T12:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mFR = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const sFR = sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return `du ${mFR} au ${sFR}`;
}

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const DAYS_FR = ["L","M","M","J","V","S","D"];

type Confirm =
  | { type: "book"; dateStr: string }
  | { type: "cancel"; dateStr: string; bookingId: number; tab: "explore" | "carousel" };

export default function BoostsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [caps, setCaps] = useState<ReturnType<typeof getPlanCapabilities>>(null);

  const [tab, setTab] = useState<"explore" | "carousel">("explore");
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const [exploreUnavailable, setExploreUnavailable] = useState<string[]>([]);
  const [myExploreBookings, setMyExploreBookings] = useState<ExploreBooking[]>([]);
  const [myCarouselBookings, setMyCarouselBookings] = useState<CarouselBooking[]>([]);

  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const venue = await getBackOfficeEstablishment(userId);
      if (!venue) { router.replace("/establishment/offers"); return; }
      const sub = await getSubscription(venue.id);
      if (!sub || sub.status !== "active") { router.replace("/establishment/offers"); return; }

      setVenueId(venue.id);
      setVenueLat(venue.lat ?? null);
      setVenueLng(venue.lng ?? null);
      setCaps(getPlanCapabilities(sub.plan));

      if (venue.lat && venue.lng) {
        const [unavail, , myExp, myCar] = await Promise.all([
          getExploreUnavailableDates(venue.lat, venue.lng, venue.id),
          getCarouselBookedDates(),
          getMyExploreBookings(venue.id),
          getMyCarouselBookings(venue.id),
        ]);
        setExploreUnavailable(unavail);
        setMyExploreBookings(myExp);
        setMyCarouselBookings(myCar);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remainingExplore = caps ? caps.spotlightQuota - myExploreBookings.length : 0;
  const remainingCarousel = caps ? caps.carouselBoostQuota - myCarouselBookings.length : 0;

  function handleDayPress(dateStr: string) {
    if (!venueId) return;
    const todayStr = today.toISOString().split("T")[0];
    if (dateStr <= todayStr) return;

    setErrorMsg(null);

    if (tab === "explore") {
      if (exploreUnavailable.includes(dateStr)) return;
      const existing = myExploreBookings.find((b) => b.booked_date === dateStr);
      if (existing) {
        setConfirm({ type: "cancel", dateStr, bookingId: existing.id, tab: "explore" });
        return;
      }
      if (remainingExplore <= 0) {
        setErrorMsg("Tu n'as plus de Coups de projecteur disponibles ce mois-ci.");
        return;
      }
      setConfirm({ type: "book", dateStr });
    } else {
      const mondayStr = getMondayOfWeek(calYear, calMonth, parseInt(dateStr.split("-")[2]));
      const existing = myCarouselBookings.find((b) => b.booked_date === mondayStr);
      if (existing) {
        setConfirm({ type: "cancel", dateStr: mondayStr, bookingId: existing.id, tab: "carousel" });
        return;
      }
      if (remainingCarousel <= 0) {
        setErrorMsg("Tu n'as plus de passages Sélection Jovial disponibles ce mois-ci.");
        return;
      }
      setConfirm({ type: "book", dateStr: mondayStr });
    }
  }

  async function handleConfirm() {
    if (!confirm || !venueId) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (confirm.type === "cancel") {
        await cancelBooking(confirm.tab, confirm.bookingId);
      } else {
        const res = tab === "explore"
          ? await bookExploreDate(venueId, confirm.dateStr, venueLat!, venueLng!)
          : await bookCarouselDate(venueId, confirm.dateStr);
        if (!res.ok) { setErrorMsg(res.error ?? "Erreur lors de la réservation."); return; }
      }
      setConfirm(null);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  function renderCalendar() {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const todayStr = today.toISOString().split("T")[0];

    const cells: ReactElement[] = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateStr(calYear, calMonth, d);
      const isPast = dateStr <= todayStr;
      const isMyExplore = myExploreBookings.some((b) => b.booked_date === dateStr);
      const dayMondayStr = getMondayStr(dateStr);
      const isMyCarousel = myCarouselBookings.some((b) => b.booked_date === dayMondayStr);
      const isUnavailableExplore = tab === "explore" && exploreUnavailable.includes(dateStr) && !isMyExplore;
      const isMyBooking = tab === "explore" ? isMyExplore : isMyCarousel;
      const isSelectedWeek = tab === "carousel" && confirm?.dateStr === dayMondayStr;
      const isSelected = tab === "explore" ? confirm?.dateStr === dateStr : isSelectedWeek;

      let bg = "transparent";
      if (isSelected) bg = Pastel.primary;
      else if (isMyBooking) bg = ORANGE;
      else if (isUnavailableExplore) bg = RED + "22";

      cells.push(
        <Pressable
          key={dateStr}
          style={[styles.dayCell, { backgroundColor: bg }]}
          onPress={() => handleDayPress(dateStr)}
          disabled={isPast || submitting}
        >
          <Text style={[
            styles.dayText,
            isPast && { color: Pastel.border },
            (isMyBooking || isSelected) && { color: "#fff", fontWeight: "700" },
            isUnavailableExplore && { color: RED },
          ]}>
            {d}
          </Text>
          {isUnavailableExplore && <View style={styles.dotRed} />}
        </Pressable>
      );
    }

    return cells;
  }

  if (loading) {
    return (
      <JovialProShell title="Coup de projecteur & Sélection Jovial" currentPath="/establishment/boosts">
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      </JovialProShell>
    );
  }

  const noAccess = !caps || (tab === "explore" ? caps.spotlightQuota === 0 : caps.carouselBoostQuota === 0);

  return (
    <JovialProShell title="Coup de projecteur & Sélection Jovial" currentPath="/establishment/boosts">
      <View style={styles.container}>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["explore", "carousel"] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => { setTab(t); setConfirm(null); setErrorMsg(null); }}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "explore" ? "🔦 Coup de projecteur" : "⭐ Sélection Jovial"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Description */}
        <View style={styles.descBox}>
          {tab === "explore" ? (
            <>
              <Text style={styles.descTitle}>🔦 Coup de projecteur</Text>
              <Text style={styles.descText}>
                Ton établissement apparaît en tête de l'onglet{" "}
                <Text style={styles.descEmphasis}>Explore</Text> pour les utilisateurs proches de toi, toute la journée sélectionnée. Un seul établissement par zone géographique (rayon de 15km) peut être mis en avant par jour.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.descTitle}>⭐ Sélection Jovial</Text>
              <Text style={styles.descText}>
                Ton établissement est mis en avant dans le carrousel{" "}
                <Text style={styles.descEmphasis}>Sélection Jovial</Text> affiché sur la page d'accueil de l'app, visible par tous les utilisateurs pendant une semaine (du lundi au dimanche).
              </Text>
            </>
          )}
        </View>

        {noAccess ? (
          <View style={styles.noAccessBox}>
            <Text style={styles.noAccessText}>
              {tab === "explore"
                ? "Le Coup de projecteur est disponible à partir de l'offre Rayonnement."
                : "La Sélection Jovial est disponible à partir de l'offre Rayonnement."}
            </Text>
            <Pressable style={styles.upgradeBtn} onPress={() => router.push("/establishment/subscription")}>
              <Text style={styles.upgradeBtnText}>Voir les offres</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Quota */}
            <View style={styles.quotaRow}>
              <View>
                <Text style={styles.quotaLabel}>
                  {tab === "explore" ? "Coups de projecteur" : "Sélection Jovial"}
                </Text>
                <Text style={styles.quotaSubLabel}>
                  {tab === "explore"
                    ? `${myExploreBookings.length} utilisé${myExploreBookings.length > 1 ? "s" : ""} sur ${caps!.spotlightQuota}`
                    : `${myCarouselBookings.length} utilisé${myCarouselBookings.length > 1 ? "s" : ""} sur ${caps!.carouselBoostQuota}`}
                </Text>
              </View>
              <View style={styles.quotaBadge}>
                <Text style={[styles.quotaValue, { color: (tab === "explore" ? remainingExplore : remainingCarousel) === 0 ? RED : GREEN }]}>
                  {tab === "explore" ? remainingExplore : remainingCarousel}
                </Text>
                <Text style={styles.quotaValueUnit}>restants</Text>
              </View>
            </View>

            {/* Navigation mois */}
            <View style={styles.monthNav}>
              <Pressable onPress={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                else setCalMonth(m => m - 1);
                setConfirm(null);
              }}>
                <Text style={styles.navArrow}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{MONTHS_FR[calMonth]} {calYear}</Text>
              <Pressable onPress={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                else setCalMonth(m => m + 1);
                setConfirm(null);
              }}>
                <Text style={styles.navArrow}>›</Text>
              </Pressable>
            </View>

            {/* Jours */}
            <View style={styles.weekRow}>
              {DAYS_FR.map((d, i) => (
                <Text key={i} style={styles.weekDay}>{d}</Text>
              ))}
            </View>

            {/* Grille */}
            <View style={styles.grid}>
              {renderCalendar()}
            </View>

            {/* Légende */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
                <Text style={styles.legendText}>Ma réservation</Text>
              </View>
              {tab === "explore" && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: RED + "44" }]} />
                  <Text style={styles.legendText}>Date indisponible (zone occupée)</Text>
                </View>
              )}
            </View>

            {/* Erreur */}
            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Panel de confirmation inline */}
            {confirm && (
              <View style={[styles.confirmBox, confirm.type === "cancel" && styles.confirmBoxDanger]}>
                <Text style={styles.confirmTitle}>
                  {confirm.type === "book"
                    ? tab === "explore"
                      ? `Réserver le ${formatDateFR(confirm.dateStr)} ?`
                      : `Réserver la semaine ${getWeekRangeFR(confirm.dateStr)} ?`
                    : tab === "explore"
                      ? `Annuler la réservation du ${formatDateFR(confirm.dateStr)} ?`
                      : `Annuler la semaine ${getWeekRangeFR(confirm.dateStr)} ?`}
                </Text>
                <Text style={styles.confirmSubtitle}>
                  {confirm.type === "book"
                    ? tab === "explore"
                      ? "Ton établissement sera mis en avant dans Explore toute la journée."
                      : "Ton établissement apparaîtra dans le carrousel Sélection Jovial pendant une semaine (du lundi au dimanche)."
                    : "Cette action est irréversible. Le créneau sera libéré."}
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable style={styles.confirmCancel} onPress={() => setConfirm(null)} disabled={submitting}>
                    <Text style={styles.confirmCancelText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmOk, confirm.type === "cancel" && styles.confirmOkDanger]}
                    onPress={handleConfirm}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmOkText}>{confirm.type === "book" ? "Confirmer" : "Supprimer"}</Text>}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Mes réservations */}
            {(tab === "explore" ? myExploreBookings : myCarouselBookings).length > 0 && (
              <View style={styles.myBookings}>
                <Text style={styles.myBookingsTitle}>Mes réservations à venir</Text>
                {(tab === "explore" ? myExploreBookings : myCarouselBookings).map((b) => (
                  <View key={b.id} style={styles.bookingRow}>
                    <Text style={styles.bookingDate}>
                      {tab === "explore" ? formatDateFR(b.booked_date) : `Semaine ${getWeekRangeFR(b.booked_date)}`}
                    </Text>
                    <Pressable onPress={() =>
                      setConfirm({ type: "cancel", dateStr: b.booked_date, bookingId: b.id, tab })
                    }>
                      <Text style={styles.cancelBtn}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Pastel.border,
    alignItems: "center", backgroundColor: Pastel.surface,
  },
  tabActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  tabText: { color: Pastel.textMuted, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  descBox: {
    backgroundColor: Pastel.primarySoft,
    borderRadius: 12, padding: 16, marginBottom: 20, gap: 6,
  },
  descTitle: { color: Pastel.text, fontSize: 15, fontWeight: "700" },
  descText: { color: Pastel.textMuted, fontSize: 13, lineHeight: 20 },
  descEmphasis: { color: Pastel.text, fontWeight: "700" },
  quotaRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
    backgroundColor: Pastel.surface,
    borderWidth: 1, borderColor: Pastel.border,
    padding: 14, borderRadius: 12,
  },
  quotaLabel: { color: Pastel.text, fontSize: 15, fontWeight: "700" },
  quotaSubLabel: { color: Pastel.textMuted, fontSize: 13, marginTop: 2 },
  quotaBadge: { alignItems: "center" },
  quotaValue: { fontSize: 28, fontWeight: "800", lineHeight: 32 },
  quotaValueUnit: { color: Pastel.textMuted, fontSize: 11, fontWeight: "600" },
  monthNav: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  navArrow: { color: Pastel.text, fontSize: 28, paddingHorizontal: 12 },
  monthLabel: { color: Pastel.text, fontSize: 16, fontWeight: "700" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: {
    flex: 1, textAlign: "center",
    color: Pastel.textMuted, fontSize: 12, fontWeight: "600",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%", height: 44,
    alignItems: "center", justifyContent: "center",
    borderRadius: 8,
  },
  dayText: { color: Pastel.text, fontSize: 14, fontWeight: "500" },
  dotRed: { width: 4, height: 4, borderRadius: 2, backgroundColor: RED, marginTop: 2 },
  legend: { flexDirection: "row", gap: 16, marginTop: 16, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: Pastel.textMuted, fontSize: 12 },
  errorBox: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA",
  },
  errorText: { color: RED, fontSize: 13, fontWeight: "600" },
  confirmBox: {
    marginTop: 16, padding: 16, borderRadius: 14,
    backgroundColor: Pastel.primarySoft,
    borderWidth: 1, borderColor: Pastel.primary + "40",
    gap: 10,
  },
  confirmBoxDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  confirmTitle: { color: Pastel.text, fontSize: 15, fontWeight: "700" },
  confirmSubtitle: { color: Pastel.textMuted, fontSize: 13, lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  confirmCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Pastel.border,
    backgroundColor: Pastel.surface, alignItems: "center",
  },
  confirmCancelText: { color: Pastel.text, fontWeight: "700", fontSize: 14 },
  confirmOk: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Pastel.primary, alignItems: "center",
  },
  confirmOkDanger: { backgroundColor: RED },
  confirmOkText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  myBookings: { marginTop: 24 },
  myBookingsTitle: { color: Pastel.text, fontSize: 15, fontWeight: "700", marginBottom: 12 },
  bookingRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Pastel.border,
  },
  bookingDate: { color: Pastel.text, fontSize: 14 },
  cancelBtn: { color: RED, fontSize: 16, paddingHorizontal: 8 },
  noAccessBox: {
    backgroundColor: Pastel.surface,
    borderWidth: 1, borderColor: Pastel.border,
    borderRadius: 14, padding: 24, alignItems: "center", gap: 16,
  },
  noAccessText: { color: Pastel.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },
  upgradeBtn: { backgroundColor: ORANGE, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
