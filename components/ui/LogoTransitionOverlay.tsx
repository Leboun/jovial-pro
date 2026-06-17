import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { registerLogoTransition } from "@/services/transition";

const NAVY = "#2B4E93";

// Sequence (style "Roland Garros") :
//  1. Le volet marine entre depuis la gauche pour couvrir l'ecran.
//  2. Une fois plein, on navigue vers la destination (le dashboard se monte derriere)
//     et le logo apparait au centre (fondu + petit zoom).
//  3. Le volet repart vers la droite en revelant le dashboard.
const ENTER_MS = 480;
const HOLD_MS = 850;
const EXIT_MS = 560;

export default function LogoTransitionOverlay() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(false);

  // translateX du volet : -width (hors ecran gauche) -> 0 (couvre) -> +width (sort a droite)
  const panelX = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    registerLogoTransition((destination: string) => {
      setActive(true);
      panelX.setValue(-width);
      logoOpacity.setValue(0);
      logoScale.setValue(0.82);

      // 1. Entree du volet
      Animated.timing(panelX, {
        toValue: 0,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        // 2. Ecran couvert : on navigue derriere + apparition du logo
        router.replace(destination as any);
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 6,
            tension: 90,
            useNativeDriver: true,
          }),
        ]).start();

        // 3. Apres la pause, le volet sort vers la droite
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(panelX, {
              toValue: width,
              duration: EXIT_MS,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
              toValue: 0,
              duration: EXIT_MS * 0.6,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(() => setActive(false));
        }, HOLD_MS);
      });
    });

    return () => registerLogoTransition(null);
  }, [width, router, panelX, logoOpacity, logoScale]);

  if (!active) return null;

  return (
    <View style={styles.root} pointerEvents="auto">
      <Animated.View style={[styles.panel, { width, transform: [{ translateX: panelX }] }]}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Image
            source={require("../../assets/images/logo_jovial.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 300,
    height: 160,
  },
});
