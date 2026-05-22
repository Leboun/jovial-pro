import { Stack, Redirect, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View, Text, useWindowDimensions, StyleSheet, Image, StatusBar as RNStatusBar } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { isDesktopWeb } from "@/utils/platform";
import { Pastel } from "@/constants/pastel";
import { useFonts } from "expo-font";
import {
  Catamaran_400Regular,
  Catamaran_600SemiBold,
  Catamaran_700Bold,
  Catamaran_800ExtraBold,
} from "@expo-google-fonts/catamaran";
import { Bangers_400Regular } from "@expo-google-fonts/bangers";

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

  if (loading) {
    return (
      <View style={styles.splash}>
        <Image
          source={require("../assets/images/logo_jovial.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator color={Pastel.cream} style={styles.splashSpinner} />
      </View>
    );
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
        {/* Barre système (heure, batterie…) — fond beige, icônes sombres */}
        <StatusBar style="dark" hidden={false} translucent backgroundColor="#F2EDE4" />
        <SafeAreaView
          style={{ flex: 1, backgroundColor: "#F2EDE4" }}
          edges={["top"]}
        >
          <View style={{ flex: 1, backgroundColor: "transparent" }}>
            <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="venue/[id]" options={{ gestureEnabled: true }} />
              <Stack.Screen name="event/[id]" options={{ gestureEnabled: true }} />
            </Stack>
          </View>
        </SafeAreaView>

        <RouteTracker />
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2B4E93",
    gap: 12,
  },
  splashLogo: {
    width: 280,
    height: 160,
  },
  splashSpinner: {
    marginTop: 8,
  },
});
