import React, { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";
import { getSubscription } from "@/services/establishment";

type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  minPlan?: "rayonnement" | "pro";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/establishment/dashboard", label: "Dashboard", icon: "grid-outline" },
  { href: "/establishment/subscription", label: "Mon offre", icon: "sparkles-outline" },
  { href: "/establishment/profile", label: "Ma fiche", icon: "business-outline" },
  { href: "/establishment/photos", label: "Photos", icon: "images-outline" },
  { href: "/establishment/activities", label: "Activités", icon: "game-controller-outline" },
  { href: "/establishment/perks", label: "Avantages", icon: "gift-outline" },
  { href: "/establishment/events", label: "Événements", icon: "calendar-outline" },
  { href: "/establishment/club", label: "Club Jovial", icon: "people-circle-outline", minPlan: "rayonnement" },
  { href: "/establishment/boosts", label: "Boosts", icon: "flash-outline", minPlan: "rayonnement" },
  { href: "/establishment/reservations", label: "Réservations", icon: "bookmark-outline" },
  { href: "/establishment/notifications", label: "Notifications", icon: "notifications-outline" },
];

type Props = {
  title: string;
  subtitle?: string;
  currentPath: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  showNavigation?: boolean;
  navVariant?: "full" | "profile-only";
  onRefresh?: () => void;
  refreshing?: boolean;
};

export default function JovialProShell({
  title,
  subtitle,
  currentPath,
  children,
  rightSlot,
  showNavigation = true,
  navVariant = "full",
  onRefresh,
  refreshing = false,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1040;
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [newNotifCount, setNewNotifCount] = useState(0);
  const [planCode, setPlanCode] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const gate = await ensureEstablishmentFeatureAccess({ userId, replace: () => {} });
        if (!gate.ok || !gate.venueId) return;
        const [sub, countResult] = await Promise.all([
          getSubscription(gate.venueId),
          supabase
            .from("reservations")
            .select("id", { count: "exact", head: true })
            .eq("venue_id", gate.venueId)
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .neq("status", "cancelled"),
        ]);
        if (!cancelled) {
          setPlanCode(sub?.plan ?? null);
          setNewNotifCount(countResult.count ?? 0);
        }
      } catch { /* silent */ }
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const isLocked = (item: NavItem) => {
    if (!item.minPlan) return false;
    if (planCode === "pro") return false;
    if (planCode === "rayonnement" && item.minPlan === "rayonnement") return false;
    return true;
  };

  const navItems =
    navVariant === "profile-only"
      ? NAV_ITEMS.filter((item) => item.href === "/establishment/profile")
      : NAV_ITEMS;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/establishment/offers");
  };

  const nav = (
    <View style={[styles.navCard, isDesktop ? styles.navCardDesktop : null]}>
      {currentPath !== "/establishment/dashboard" ? (
        <Pressable
          style={styles.backToAppBtn}
          onPress={() => router.push("/establishment/dashboard" as any)}
        >
          <Ionicons name="chevron-back" size={14} color="#FFFFFF" />
          <Text style={styles.backToAppBtnText}>← Dashboard</Text>
        </Pressable>
      ) : null}

      <View style={styles.brandBlock}>
        <View style={styles.brandRow}>
          <View style={styles.brandLogoSmall}>
            <Text style={styles.brandLogoText}>J</Text>
          </View>
          <View style={styles.brandTextBlock}>
            <Text style={styles.brandEyebrow}>JOVIAL PRO</Text>
            <Text style={styles.brandTitle}>Espace partenaire</Text>
          </View>
        </View>
        <Text style={styles.brandText}>
          Gère ta fiche, tes activités, tes événements et tes réservations.
        </Text>
      </View>

      <View style={styles.navList}>
        {navItems.map((item) => {
          const active = currentPath === item.href;
          const locked = isLocked(item);
          return (
            <Pressable
              key={item.href}
              style={[styles.navItem, active ? styles.navItemActive : null, locked ? styles.navItemLocked : null]}
              onPress={() => {
                if (locked) {
                  router.push("/establishment/subscription" as any);
                } else {
                  router.push(item.href as any);
                }
              }}
            >
              <Ionicons
                name={locked ? "lock-closed-outline" : item.icon}
                size={18}
                color={active ? "#FFFFFF" : locked ? Pastel.border : Pastel.textMuted}
              />
              <Text style={[styles.navItemText, active ? styles.navItemTextActive : null, locked ? styles.navItemTextLocked : null]}>
                {item.label}
              </Text>
              {item.href === "/establishment/notifications" && newNotifCount > 0 && !locked ? (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{newNotifCount > 9 ? "9+" : newNotifCount}</Text>
                </View>
              ) : null}
              {locked ? (
                <View style={styles.navUpgradePill}>
                  <Text style={styles.navUpgradePillText}>Upgrade</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {confirmLogout ? (
        <View style={styles.logoutConfirm}>
          <Text style={styles.logoutConfirmText}>Confirmer la déconnexion ?</Text>
          <View style={styles.logoutConfirmRow}>
            <Pressable style={styles.logoutConfirmCancel} onPress={() => setConfirmLogout(false)}>
              <Text style={styles.logoutConfirmCancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.logoutConfirmOk} onPress={handleLogout}>
              <Text style={styles.logoutConfirmOkText}>Se déconnecter</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.logoutBtn} onPress={() => setConfirmLogout(true)}>
          <Ionicons name="log-out-outline" size={16} color={Pastel.danger} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      )}
    </View>
  );

  if (!showNavigation) {
    return (
      <View style={styles.page}>
        <View style={styles.mainPaneStandalone}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.pageTitle}>{title}</Text>
              {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
            </View>
            {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
          </View>
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" /> : undefined}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {isDesktop ? (
        <View style={styles.desktopLayout}>
          <View style={styles.sidebar}>{nav}</View>
          <View style={styles.mainPane}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextBlock}>
                <Text style={styles.pageTitle}>{title}</Text>
                {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
              </View>
              {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
            </View>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
              refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" /> : undefined}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.mobileScroll}
          contentContainerStyle={styles.mobileContent}
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" /> : undefined}
        >
          {nav}
          <View style={styles.mobileHeader}>
            <Text style={styles.pageTitle}>{title}</Text>
            {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
            {rightSlot ? <View style={styles.mobileRightSlot}>{rightSlot}</View> : null}
          </View>
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Pastel.background,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 300,
    padding: 20,
    paddingRight: 0,
  },
  mainPane: {
    flex: 1,
    padding: 20,
    paddingLeft: 16,
  },
  mainPaneStandalone: {
    flex: 1,
    padding: 20,
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
  },
  navCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 18,
    gap: 18,
    shadowColor: Pastel.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  navCardDesktop: {
    flex: 1,
  },
  brandBlock: {
    gap: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandLogoSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  brandTextBlock: {
    gap: 1,
  },
  brandEyebrow: {
    color: Pastel.orange,
    fontSize: 10,
    fontFamily: Font.extraBold,
    letterSpacing: 1.4,
  },
  brandTitle: {
    color: Pastel.text,
    fontSize: 18,
    fontFamily: Font.display,
    letterSpacing: 1,
  },
  brandText: {
    color: Pastel.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Font.regular,
  },
  navList: {
    gap: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: Pastel.surfaceAlt,
  },
  navItemActive: {
    backgroundColor: Pastel.primary,
    shadowColor: Pastel.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  navItemText: {
    color: Pastel.text,
    fontSize: 14,
    fontFamily: Font.bold,
  },
  navItemTextActive: {
    color: "#FFFFFF",
    fontFamily: Font.bold,
  },
  navItemLocked: {
    opacity: 0.5,
    backgroundColor: Pastel.surfaceAlt,
  },
  navItemTextLocked: {
    color: Pastel.textMuted,
  },
  navUpgradePill: {
    marginLeft: "auto",
    backgroundColor: "#F59E0B",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  navUpgradePillText: { fontSize: 9, fontWeight: "800", color: "#FFFFFF" },
  navBadge: {
    marginLeft: "auto",
    backgroundColor: "#EF4444",
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  navBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    backgroundColor: "#FFF5F5",
  },
  logoutText: {
    color: Pastel.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  logoutConfirm: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    backgroundColor: "#FFF5F5",
    padding: 12,
    gap: 10,
  },
  logoutConfirmText: {
    color: Pastel.danger,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  logoutConfirmRow: {
    flexDirection: "row",
    gap: 8,
  },
  logoutConfirmCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  logoutConfirmCancelText: {
    color: Pastel.text,
    fontSize: 13,
    fontWeight: "700",
  },
  logoutConfirmOk: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Pastel.danger,
  },
  logoutConfirmOkText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  headerTextBlock: {
    gap: 6,
    flex: 1,
  },
  pageTitle: {
    color: Pastel.text,
    fontSize: 32,
    fontFamily: Font.display,
    letterSpacing: 1,
  },
  pageSubtitle: {
    color: Pastel.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Font.regular,
  },
  rightSlot: {
    minWidth: 220,
    alignItems: "flex-end",
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: 42,
    gap: 16,
  },
  mobileScroll: {
    flex: 1,
  },
  mobileContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  mobileHeader: {
    gap: 6,
  },
  mobileRightSlot: {
    marginTop: 6,
  },
  backToAppBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  backToAppBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
});
