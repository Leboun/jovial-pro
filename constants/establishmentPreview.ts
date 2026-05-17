const getRuntimeHostname = () => {
  if (typeof window !== "undefined") {
    return window.location?.hostname ?? "";
  }
  if (typeof globalThis !== "undefined" && "location" in globalThis) {
    return (globalThis.location as Location | undefined)?.hostname ?? "";
  }
  return "";
};

export const isEstablishmentPreviewRuntimeEnabled = () => {
  const host = getRuntimeHostname();
  return (
    __DEV__ ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    process.env.EXPO_PUBLIC_ESTABLISHMENT_PREVIEW === "1"
  );
};

export const ESTABLISHMENT_PREVIEW_ENABLED = isEstablishmentPreviewRuntimeEnabled();

export const ESTABLISHMENT_PREVIEW_VENUE_ID = -999;

export const isEstablishmentPreviewEnabled = (userId?: string | null) =>
  Boolean(userId) && isEstablishmentPreviewRuntimeEnabled();
