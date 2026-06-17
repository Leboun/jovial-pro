import { Stack, Redirect, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View, Text, useWindowDimensions, StyleSheet, Image } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { isDesktopWeb } from "@/utils/platform";
import { Pastel } from "@/constants/pastel";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import LogoTransitionOverlay from "@/components/ui/LogoTransitionOverlay";
import {
  Catamaran_400Regular,
  Catamaran_600SemiBold,
  Catamaran_700Bold,
  Catamaran_800ExtraBold,
} from "@expo-google-fonts/catamaran";
import { Bangers_400Regular } from "@expo-google-fonts/bangers";

// On garde le splash NATIF affiche jusqu'a ce que l'app soit prete -> un seul logo,
// aucun "saut" entre splash natif et splash React.
SplashScreen.preventAutoHideAsync().catch(() => {});

const LAST_ROUTE_KEY = "jovial.lastRoute";
const SKIP_SAVE_PREFIXES = ["/", "/index", "/welcome", "/establishment/welcome", "/establishment/offers", "/establishment/login", "/establishment/signup"];

function saveLastRoute(path: string) {
  if (Platform.OS !== "web") return;
  if (SKIP_SAVE_PREFIXES.some((p) => path === p || path.startsWith(p + "?"))) return;
  try { sessionStorage.setItem(LAST_ROUTE_KEY, path); } catch { /* ignore */ }
}

function popLastRoute(): string | null {
  if (Platform.OS !== "web") return null;
  try {
    const saved = sessionStorage.getItem(LAST_ROUTE_KEY);
    return saved ?? null;
  } catch { return null; }
}

function RouteTracker() {
  const pathname = usePathname();
  useEffect(() => { saveLastRoute(pathname); }, [pathname]);
  return null;
}

const PUBLIC_PREFIXES = ["/welcome", "/establishment/welcome", "/(auth)", "/auth/"];

function isPublicRoute(path: string) {
  return path === "/" || path === "/index" || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

function AuthGate() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const desktopWeb = isDesktopWeb(width);
  const pathname = usePathname();
  const router = useRouter();
  const isEntryRoute = pathname === "/" || pathname === "/index";
  const prevSession = useRef<typeof session>(undefined);

  // Duree minimale d'affichage du splash logo (mobile) pour qu'il soit bien visible,
  // meme si la session se charge instantanement. Sur web: aucun delai.
  const [minSplashDone, setMinSplashDone] = useState(Platform.OS === "web");
  useEffect(() => {
    if (Platform.OS === "web") return;
    const t = setTimeout(() => setMinSplashDone(true), 1000);
    return () => clearTimeout(t);
  }, []);

  // Redirige vers welcome quand la session expire ou que l'utilisateur se déconnecte
  useEffect(() => {
    if (loading) return;
    const wasLoggedIn = prevSession.current !== undefined && prevSession.current !== null;
    const isNowLoggedOut = session === null;
    if (wasLoggedIn && isNowLoggedOut && !isPublicRoute(pathname)) {
      router.replace("/welcome");
    }
    prevSession.current = session;
  }, [session, loading, pathname]);

  // Masque le splash NATIF uniquement quand l'app est prete (+ duree mini).
  const ready = !loading && minSplashDone;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  // Filet de securite : ne jamais rester bloque sur le splash.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    // On ne rend rien : le splash natif (un seul logo) reste affiche par-dessus.
    return null;
  }

  if (!isEntryRoute) {
    return null;
  }

  if (!session) {
    return <Redirect href={desktopWeb ? "/establishment/welcome" : "/welcome"} />;
  }

  const lastRoute = popLastRoute();
  const defaultRoute = desktopWeb ? "/establishment/dashboard" : "/(tabs)/map";
  return <Redirect href={(lastRoute ?? defaultRoute) as any} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Catamaran_400Regular,
    Catamaran_600SemiBold,
    Catamaran_700Bold,
    Catamaran_800ExtraBold,
    Bangers_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" hidden={false} backgroundColor="#F2EDE4" translucent={false} />
        <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={[]}>
          <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="venue/[id]" options={{ gestureEnabled: true }} />
            <Stack.Screen name="event/[id]" options={{ gestureEnabled: true }} />
          </Stack>
        </SafeAreaView>

        <RouteTracker />
        <AuthGate />
        <LogoTransitionOverlay />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2B4E93",
    gap: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  splashLogo: {
    // Meme largeur que le splash natif (app.json imageWidth: 200) pour eviter le
    // petit "saut" de taille au moment ou React prend le relais.
    width: 200,
    height: 200,
  },
  splashSpinner: {
    marginTop: 8,
  },
});
