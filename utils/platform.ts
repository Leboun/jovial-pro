import { Platform } from "react-native";

export const DESKTOP_WEB_MIN_WIDTH = 1040;

export function isDesktopWeb(width: number) {
  return Platform.OS === "web" && width >= DESKTOP_WEB_MIN_WIDTH;
}
