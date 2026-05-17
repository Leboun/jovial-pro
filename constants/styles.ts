import { Platform, TextStyle, ViewStyle } from "react-native";

/**
 * Normalise le rendu du texte custom font sur Android.
 * Android ajoute du padding interne (includeFontPadding) qui décale
 * verticalement le texte par rapport à iOS. À appliquer sur tout Text
 * avec fontFamily.
 */
export const textBase: TextStyle = {
  includeFontPadding: false,
};

/**
 * Génère des ombres cross-platform cohérentes.
 * iOS utilise shadow*, Android utilise elevation.
 *
 * Usage : shadow(Pastel.primary, 0.25, 12, 4)
 */
export function shadow(
  color = "#000000",
  opacity = 0.12,
  radius = 8,
  elevation = 4,
  offsetY = 4
): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: {
      elevation,
    },
    default: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
      elevation,
    },
  }) as ViewStyle;
}

/**
 * Ombres prédéfinies pour usage cohérent dans l'app.
 */
export const shadows = {
  none: {} as ViewStyle,
  xs: shadow("#000", 0.06, 4, 2, 2),
  sm: shadow("#000", 0.08, 8, 3, 3),
  md: shadow("#000", 0.12, 14, 5, 5),
  lg: shadow("#000", 0.16, 20, 8, 8),
  xl: shadow("#000", 0.20, 28, 12, 10),
  card: shadow("#000", 0.10, 12, 4, 4),
};
