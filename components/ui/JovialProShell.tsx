import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useEstablishment } from "@/providers/EstablishmentProvider";
import { planCodeToOfferKey } from "@/utils/jovialProBilling";

const LOGO_BOX_H = 84; // hauteur du logo etablissement dans la sidebar (largeur adaptative)

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
  { href: "/establishment/communication-kit", label: "Kit de comm", icon: "megaphone-outline" },
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
  loading?: boolean;
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
  loading = false,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1040;
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [newNotifCount, setNewNotifCount] = useState(0);
  const { subscription, venue, loading: subLoading } = useEstablishment();
  const planCode = subscription?.plan ?? null;
  // Ratio du logo etablissement pour l'afficher de maniere adaptative (carre / rectangle / long).
  const [logoAspect, setLogoAspect] = useState<number | null>(null);
  useEffect(() => {
    setLogoAspect(null);
    if (!venue?.logo_url) return;
    Image.getSize(
      venue.logo_url,
      (w, h) => { if (h > 0) setLogoAspect(w / h); },
      () => setLogoAspect(null)
    );
  }, [venue?.logo_url]);
  // Destination directe pour l'onglet "Mon offre" : si un abonnement est actif,
  // on va droit a la page detail de l'offre pour eviter le saut (page liste -> redirection).
  const activeOfferKey =
    subscription && subscription.status === "active" ? planCodeToOfferKey(subscription.plan) : null;
  const resolveHref = (href: string) =>
    href === "/establishment/subscription" && activeOfferKey
      ? `/establishment/subscription/${activeOfferKey}`
      : href;

  useEffect(() => {
    if (!venue?.id) return;
    let cancelled = false;
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .neq("status", "cancelled")
      .then(({ count }) => {
        if (!cancelled) setNewNotifCount(count ?? 0);
      });
    return () => { cancelled = true; };
  }, [venue?.id]);

  const isLocked = (item: NavItem) => {
    if (!item.minPlan) return false;
    if (subLoading) return false;
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
        {venue?.logo_url ? (
          <Image
            source={{ uri: venue.logo_url }}
            style={[
              styles.brandLogoAdaptive,
              { width: LOGO_BOX_H * Math.min(2.8, Math.max(0.8, logoAspect ?? 1)) },
            ]}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.brandRow}>
            <View style={styles.brandLogoSmall}>
              <Image
                source={require("../../assets/images/logo_mascotte.png")}
                style={styles.brandLogoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>Jovial Pro</Text>
          </View>
        )}
        <Text style={styles.brandText}>
          Gère ta fiche, tes activités, tes événements et tes réservations.
        </Text>
      </View>

      <View style={styles.navList}>
        {navItems.map((item) => {
          const active =
            currentPath === item.href ||
            (item.href === "/establishment/subscription" &&
              currentPath.startsWith("/establishment/subscription"));
          const locked = isLocked(item);
          return (
            <Pressable
              key={item.href}
              style={[styles.navItem, active ? styles.navItemActive : null, locked ? styles.navItemLocked : null]}
              onPress={() => {
                if (locked) {
                  router.push("/establishment/subscription" as any);
                } else {
                  router.push(resolveHref(item.href) as any);
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
          <Text style={styles.logoutText} numberOfLines={1}>Se déconnecter</Text>
        </Pressable>
      )}

      <View style={styles.brandFooter}>
        <Image
          source={require("../../assets/images/logo_jovial.png")}
          style={styles.brandFooterLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandFooterText}>Propulsé par Jovial</Text>
      </View>
    </View>
  );

  if (!showNavigation) {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.standaloneContent}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" /> : undefined}
      >
        <View style={styles.mainPaneStandalone}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.pageTitle}>{title}</Text>
              {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
            </View>
            {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.page}>
      {isDesktop ? (
        <View style={styles.desktopLayout}>
          <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
            {nav}
          </ScrollView>
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
              {loading ? <View style={styles.loadingBox}><ActivityIndicator color={Pastel.primary} size="large" /></View> : children}
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
          {loading ? <View style={styles.loadingBox}><ActivityIndicator color={Pastel.primary} size="large" /></View> : children}
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
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 230,
    minWidth: 230,
    maxWidth: 230,
    flexGrow: 0,
    flexShrink: 0,
  },
  sidebarContent: {
    padding: 16,
    paddingRight: 0,
    flexGrow: 1,
    paddingBottom: 24,
  },
  mainPane: {
    flex: 1,
    padding: 20,
    paddingLeft: 16,
  },
  mainPaneStandalone: {
    padding: 20,
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
  },
  standaloneContent: {
    flexGrow: 1,
    paddingBottom: 48,
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
  brandLogoAdaptive: {
    height: LOGO_BOX_H,
    maxWidth: "100%",
    alignSelf: "center",
  },
  brandLogoSmall: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandLogoImg: { width: "100%", height: "100%" },
  brandLogoText: {
    color: Pastel.primary,
    fontSize: 30,
    fontFamily: Font.display,
    letterSpacing: -0.5,
  },
  brandTextBlock: {
    gap: 1,
  },
  brandEyebrow: {
    color: Pastel.teal,
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
  brandFooter: {
    alignItems: "center",
    gap: 5,
    paddingTop: 6,
  },
  brandFooterLogo: {
    width: 104,
    height: 38,
  },
  brandFooterText: {
    color: Pastel.textMuted,
    fontSize: 10,
    fontFamily: Font.semiBold,
    letterSpacing: 0.4,
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
    flexDirection: "column",
    gap: 8,
  },
  logoutConfirmCancel: {
    alignSelf: "stretch",
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
    alignSelf: "stretch",
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
    color: Pastel.text,
    fontSize: 18,
    lineHeight: 26,
    fontFamily: Font.semiBold,
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
    backgroundColor: "#2B4E93",
  },
  backToAppBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
});
