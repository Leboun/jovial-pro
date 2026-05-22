import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import {
  addVenueBlackout,
  addVenueClosure,
  deleteVenueBlackout,
  deleteVenueClosure,
  fetchVenueBlackouts,
  fetchVenueClosures,
  VenueBlackout,
  VenueClosure,
} from "@/services/bookings";
import { supabase } from "@/services/supabase";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";

type ActivityRow = { id: number; game_id: number; name: string; quantity: number };
type Tab = "closures" | "blackouts";

const toMonthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isInRange = (d: Date, start: Date | null, end: Date | null) => {
  if (!start) return false;
  const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : s;
  return dayOnly >= s && dayOnly <= e;
};
const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const formatDateFR = (str: string) => {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};
const localTzOffset = (() => {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const m = String(Math.abs(off) % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
})();

const formatDateTimeFR = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function MiniCalendar({
  month,
  onPrev,
  onNext,
  onSelectDay,
  startDate,
  endDate,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (d: Date) => void;
  startDate: Date | null;
  endDate: Date | null;
}) {
  const label = month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const blanks = mondayIndex(month);
  const total = daysInMonth(month);
  const days: Array<number | null> = [];
  for (let i = 0; i < blanks; i++) days.push(null);
  for (let d = 1; d <= total; d++) days.push(d);

  return (
    <View style={cal.wrapper}>
      <View style={cal.header}>
        <Pressable style={cal.nav} onPress={onPrev}>
          <Ionicons name="chevron-back" size={14} color="#111827" />
        </Pressable>
        <Text style={cal.title}>{label}</Text>
        <Pressable style={cal.nav} onPress={onNext}>
          <Ionicons name="chevron-forward" size={14} color="#111827" />
        </Pressable>
      </View>
      <View style={cal.weekdays}>
        {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => (
          <Text key={i} style={cal.weekday}>{l}</Text>
        ))}
      </View>
      <View style={cal.grid}>
        {days.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={cal.empty} />;
          const dayDate = new Date(month.getFullYear(), month.getMonth(), day);
          const inRange = isInRange(dayDate, startDate, endDate);
          const isStart = startDate ? isSameDay(dayDate, startDate) : false;
          const isEnd = endDate ? isSameDay(dayDate, endDate) : false;
          const highlighted = isStart || isEnd;
          return (
            <Pressable
              key={`d-${day}`}
              style={[cal.day, inRange ? cal.dayRange : null, highlighted ? cal.daySelected : null]}
              onPress={() => onSelectDay(dayDate)}
            >
              <Text style={[cal.dayText, highlighted ? cal.dayTextSelected : null]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function EstablishmentBlackoutsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("closures");

  // Fermetures
  const [closures, setClosures] = useState<VenueClosure[]>([]);
  const [closureStartDate, setClosureStartDate] = useState<Date | null>(null);
  const [closureEndDate, setClosureEndDate] = useState<Date | null>(null);
  const [closureReason, setClosureReason] = useState("");
  const [closureMonth, setClosureMonth] = useState(() => toMonthStart(new Date()));
  const [closureError, setClosureError] = useState<string | null>(null);

  // Blackouts activité
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [blackouts, setBlackouts] = useState<VenueBlackout[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [blackoutDate, setBlackoutDate] = useState<Date | null>(null);
  const [blackoutMonth, setBlackoutMonth] = useState(() => toMonthStart(new Date()));
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [quantityBlocked, setQuantityBlocked] = useState<number | null>(null);
  const [blackoutReason, setBlackoutReason] = useState("");
  const [blackoutError, setBlackoutError] = useState<string | null>(null);

  const loadData = useCallback(async (vid: number) => {
    const [cls, bls] = await Promise.all([
      fetchVenueClosures(vid),
      fetchVenueBlackouts(vid),
    ]);
    setClosures(cls);
    setBlackouts(bls);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
          if (!gate.ok || !gate.venueId) return;
          if (cancelled) return;
          setVenueId(gate.venueId);

          const { data } = await supabase
            .from("venue_games")
            .select("id, game_id, quantity, games(name)")
            .eq("venue_id", gate.venueId);

          const clean = ((data as any[] | null) ?? [])
            .map((row) => ({ id: Number(row?.id), game_id: Number(row?.game_id), name: String(row?.games?.name ?? "").trim(), quantity: Number(row?.quantity ?? 1) }))
            .filter((a) => a.name && Number.isFinite(a.game_id));

          if (!cancelled) {
            setActivities(clean);
            if (clean.length > 0) { setSelectedGameId(clean[0].game_id); setQuantityBlocked(clean[0].quantity); }
            await loadData(gate.venueId);
          }
        } catch { /* ignore */ } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [userId, router, loadData])
  );

  const handleRefresh = useCallback(async () => {
    if (!venueId) return;
    setRefreshing(true);
    try { await loadData(venueId); } catch { /* ignore */ } finally { setRefreshing(false); }
  }, [venueId, loadData]);

  const gameNameById = useMemo(() => {
    const m = new Map<number, string>();
    activities.forEach((a) => m.set(a.game_id, a.name));
    return m;
  }, [activities]);

  // ── Fermetures ──────────────────────────────────────────────
  const handleClosureDayPress = (d: Date) => {
    if (!closureStartDate || (closureStartDate && closureEndDate)) {
      setClosureStartDate(d);
      setClosureEndDate(null);
    } else {
      if (d < closureStartDate) {
        setClosureEndDate(closureStartDate);
        setClosureStartDate(d);
      } else {
        setClosureEndDate(d);
      }
    }
  };

  const handleAddClosure = async () => {
    if (!venueId || !closureStartDate) {
      setClosureError("Sélectionne au moins une date.");
      return;
    }
    setClosureError(null);
    const start = formatDateKey(closureStartDate);
    const end = formatDateKey(closureEndDate ?? closureStartDate);
    try {
      setSaving(true);
      await addVenueClosure(venueId, start, end, closureReason);
      setClosureStartDate(null);
      setClosureEndDate(null);
      setClosureReason("");
      await loadData(venueId);
    } catch {
      setClosureError("Impossible d'enregistrer la fermeture.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClosure = async (id: number) => {
    if (!venueId) return;
    try {
      await deleteVenueClosure(id);
      setClosures((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  };

  // ── Blackouts activité ───────────────────────────────────────
  const handleBlackoutDayPress = (d: Date) => setBlackoutDate(d);

  const handleAddBlackout = async () => {
    if (!venueId || !selectedGameId || !blackoutDate) {
      setBlackoutError("Sélectionne une activité et une date.");
      return;
    }
    const dateStr = formatDateKey(blackoutDate);
    const startsAt = allDay ? `${dateStr}T00:00:00${localTzOffset}` : `${dateStr}T${startTime.trim()}:00${localTzOffset}`;
    const endsAt = allDay ? `${dateStr}T23:59:59${localTzOffset}` : `${dateStr}T${endTime.trim()}:00${localTzOffset}`;

    if (!allDay && (!startTime.trim() || !endTime.trim())) {
      setBlackoutError("Renseigne l'heure de début et de fin.");
      return;
    }
    const selectedActivity = activities.find((a) => a.game_id === selectedGameId);
    const finalQtyBlocked = (quantityBlocked != null && selectedActivity && quantityBlocked < selectedActivity.quantity)
      ? quantityBlocked
      : null;
    setBlackoutError(null);
    try {
      setSaving(true);
      const newId = await addVenueBlackout(venueId, selectedGameId, startsAt, endsAt, blackoutReason, finalQtyBlocked);
      if (newId) {
        await supabase.functions.invoke("booking-cancel-on-blackout", { body: { blackout_id: newId } });
      }
      setBlackoutDate(null);
      setStartTime("");
      setEndTime("");
      setBlackoutReason("");
      setAllDay(true);
      setQuantityBlocked(selectedActivity?.quantity ?? null);
      await loadData(venueId);
    } catch {
      setBlackoutError("Impossible d'enregistrer le blocage.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlackout = async (id: number) => {
    if (!venueId) return;
    try {
      await deleteVenueBlackout(id);
      setBlackouts((prev) => prev.filter((b) => b.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <JovialProShell
      currentPath={pathname}
      title="Disponibilités"
      subtitle="Gérez les fermetures exceptionnelles et les blocages d'activités."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
    >
      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "closures" ? styles.tabActive : null]}
          onPress={() => setTab("closures")}
        >
          <Text style={[styles.tabText, tab === "closures" ? styles.tabTextActive : null]}>
            Fermetures exceptionnelles
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "blackouts" ? styles.tabActive : null]}
          onPress={() => setTab("blackouts")}
        >
          <Text style={[styles.tabText, tab === "blackouts" ? styles.tabTextActive : null]}>
            Blocage d'activité
          </Text>
        </Pressable>
      </View>

      {tab === "closures" ? (
        <>
          {/* Formulaire fermeture */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ajouter une fermeture</Text>
            <Text style={styles.helper}>
              Sélectionne une date ou une plage de dates. Toutes les réservations sur cette période seront bloquées.
            </Text>

            <MiniCalendar
              month={closureMonth}
              onPrev={() => setClosureMonth((p) => toMonthStart(new Date(p.getFullYear(), p.getMonth() - 1, 1)))}
              onNext={() => setClosureMonth((p) => toMonthStart(new Date(p.getFullYear(), p.getMonth() + 1, 1)))}
              onSelectDay={handleClosureDayPress}
              startDate={closureStartDate}
              endDate={closureEndDate}
            />

            {closureStartDate ? (
              <View style={styles.selectedRange}>
                <Ionicons name="calendar-outline" size={14} color="#374151" />
                <Text style={styles.selectedRangeText}>
                  {closureEndDate && !isSameDay(closureStartDate, closureEndDate)
                    ? `Du ${formatDateFR(formatDateKey(closureStartDate))} au ${formatDateFR(formatDateKey(closureEndDate))}`
                    : `Le ${formatDateFR(formatDateKey(closureStartDate))}`}
                </Text>
              </View>
            ) : (
              <Text style={styles.helper}>Tape sur une date pour commencer, puis sur une autre pour définir la fin.</Text>
            )}

            <TextInput
              value={closureReason}
              onChangeText={setClosureReason}
              placeholder="Motif (optionnel) — ex : vacances, travaux..."
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />

            {closureError ? <Text style={styles.errorText}>{closureError}</Text> : null}

            <Pressable
              style={[styles.primaryBtn, (saving || !closureStartDate) ? styles.btnDisabled : null]}
              onPress={handleAddClosure}
              disabled={saving || !closureStartDate}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Ajouter la fermeture</Text>}
            </Pressable>
          </View>

          {/* Liste fermetures */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fermetures à venir ({closures.length})</Text>
            {closures.length === 0 ? (
              <Text style={styles.emptyText}>Aucune fermeture planifiée.</Text>
            ) : (
              closures.map((c) => (
                <View key={c.id} style={styles.listItem}>
                  <View style={styles.listItemContent}>
                    <View style={styles.listItemIcon}>
                      <Ionicons name="lock-closed" size={14} color="#6B7280" />
                    </View>
                    <View style={styles.listItemText}>
                      <Text style={styles.listItemTitle}>
                        {isSameDay(new Date(c.date_start + "T12:00:00"), new Date(c.date_end + "T12:00:00"))
                          ? formatDateFR(c.date_start)
                          : `${formatDateFR(c.date_start)} → ${formatDateFR(c.date_end)}`}
                      </Text>
                      {c.reason ? <Text style={styles.listItemSub}>{c.reason}</Text> : null}
                    </View>
                  </View>
                  <Pressable onPress={() => handleDeleteClosure(c.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </>
      ) : (
        <>
          {/* Formulaire blackout activité */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bloquer une activité</Text>
            <Text style={styles.helper}>
              Bloque une activité spécifique sur un créneau précis. Les réservations existantes seront annulées.
            </Text>

            <Text style={styles.fieldLabel}>Activité</Text>
            <View style={styles.chipRow}>
              {activities.map((a) => {
                const active = a.game_id === selectedGameId;
                return (
                  <Pressable
                    key={a.game_id}
                    style={[styles.chip, active ? styles.chipActive : null]}
                    onPress={() => { setSelectedGameId(a.game_id); setQuantityBlocked(a.quantity); }}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{a.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            {(() => {
              const act = activities.find((a) => a.game_id === selectedGameId);
              if (!act || act.quantity <= 1) return null;
              const qty = quantityBlocked ?? act.quantity;
              return (
                <View style={styles.qtyBlock}>
                  <Text style={styles.fieldLabel}>Quantité à bloquer : {qty}/{act.quantity}</Text>
                  <View style={styles.qtyRow}>
                    <Pressable style={styles.qtyBtn} onPress={() => setQuantityBlocked(Math.max(1, qty - 1))}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{qty}</Text>
                    <Pressable style={styles.qtyBtn} onPress={() => setQuantityBlocked(Math.min(act.quantity, qty + 1))}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                  {qty < act.quantity ? (
                    <Text style={styles.qtyHint}>{act.quantity - qty} restant{act.quantity - qty > 1 ? "s" : ""} disponible{act.quantity - qty > 1 ? "s" : ""}</Text>
                  ) : (
                    <Text style={styles.qtyHintFull}>Tout bloqué</Text>
                  )}
                </View>
              );
            })()}

            <Text style={styles.fieldLabel}>Date</Text>
            <MiniCalendar
              month={blackoutMonth}
              onPrev={() => setBlackoutMonth((p) => toMonthStart(new Date(p.getFullYear(), p.getMonth() - 1, 1)))}
              onNext={() => setBlackoutMonth((p) => toMonthStart(new Date(p.getFullYear(), p.getMonth() + 1, 1)))}
              onSelectDay={handleBlackoutDayPress}
              startDate={blackoutDate}
              endDate={null}
            />

            {blackoutDate ? (
              <View style={styles.selectedRange}>
                <Ionicons name="calendar-outline" size={14} color="#374151" />
                <Text style={styles.selectedRangeText}>{formatDateFR(formatDateKey(blackoutDate))}</Text>
              </View>
            ) : null}

            <Pressable style={styles.toggleRow} onPress={() => setAllDay((p) => !p)}>
              <View style={[styles.toggleBox, allDay ? styles.toggleBoxOn : null]}>
                {allDay ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.toggleLabel}>Bloquer toute la journée</Text>
            </Pressable>

            {!allDay ? (
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.fieldLabel}>Début (HH:MM)</Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="18:00"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.fieldLabel}>Fin (HH:MM)</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="23:00"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                </View>
              </View>
            ) : null}

            <TextInput
              value={blackoutReason}
              onChangeText={setBlackoutReason}
              placeholder="Motif (optionnel) — ex : événement privé..."
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />

            {blackoutError ? <Text style={styles.errorText}>{blackoutError}</Text> : null}

            <Pressable
              style={[styles.primaryBtn, (saving || !blackoutDate || !selectedGameId) ? styles.btnDisabled : null]}
              onPress={handleAddBlackout}
              disabled={saving || !blackoutDate || !selectedGameId}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Ajouter le blocage</Text>}
            </Pressable>
          </View>

          {/* Liste blackouts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Blocages à venir ({blackouts.length})</Text>
            {blackouts.length === 0 ? (
              <Text style={styles.emptyText}>Aucun blocage d'activité planifié.</Text>
            ) : (
              blackouts.map((b) => (
                <View key={b.id} style={styles.listItem}>
                  <View style={styles.listItemContent}>
                    <View style={styles.listItemIcon}>
                      <Ionicons name="ban" size={14} color="#6B7280" />
                    </View>
                    <View style={styles.listItemText}>
                      <Text style={styles.listItemTitle}>
                        {gameNameById.get(b.game_id) ?? "Activité"}
                        {b.quantity_blocked != null ? ` (${b.quantity_blocked} bloqué${b.quantity_blocked > 1 ? "s" : ""})` : ""}
                        {" — "}{formatDateTimeFR(b.starts_at)}
                      </Text>
                      <Text style={styles.listItemSub}>
                        jusqu'à {formatDateTimeFR(b.ends_at)}{b.reason ? ` · ${b.reason}` : ""}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleDeleteBlackout(b.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </JovialProShell>
  );
}

const cal = StyleSheet.create({
  wrapper: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 13, fontWeight: "700", color: "#111827" },
  nav: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  weekdays: { flexDirection: "row" },
  weekday: { width: "14.2857%", textAlign: "center", fontSize: 10, color: "#9CA3AF", fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  empty: { width: "14.2857%", aspectRatio: 1 },
  day: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#F3F4F6" },
  dayRange: { backgroundColor: "#EFF6FF" },
  daySelected: { backgroundColor: "#111827" },
  dayText: { fontSize: 12, color: "#111827", fontWeight: "600" },
  dayTextSelected: { color: "#FFFFFF" },
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  tabText: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", textAlign: "center" },
  tabTextActive: { color: "#FFFFFF" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 14,
  },
  cardTitle: { color: "#111827", fontSize: 17, fontWeight: "800" },
  helper: { color: "#9CA3AF", fontSize: 13, lineHeight: 19 },
  fieldLabel: { color: "#111827", fontSize: 13, fontWeight: "700" },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 44,
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 14,
  },
  selectedRange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  selectedRangeText: { color: "#15803D", fontSize: 13, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  toggleBoxOn: { backgroundColor: "#111827", borderColor: "#111827" },
  toggleLabel: { color: "#111827", fontSize: 13, fontWeight: "600" },
  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1, gap: 6 },
  primaryBtn: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "600", backgroundColor: "#FEF2F2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  emptyText: { color: "#9CA3AF", fontSize: 13 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  listItemContent: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  listItemIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  listItemText: { flex: 1, gap: 2 },
  listItemTitle: { color: "#111827", fontSize: 13, fontWeight: "700" },
  listItemSub: { color: "#9CA3AF", fontSize: 12 },
  qtyBlock: { gap: 8, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 18, fontWeight: "700", color: "#111827" },
  qtyValue: { fontSize: 20, fontWeight: "800", color: "#111827", minWidth: 30, textAlign: "center" },
  qtyHint: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  qtyHintFull: { fontSize: 12, color: "#DC2626", fontWeight: "700" },
});
