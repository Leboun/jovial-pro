// mobile/services/supabase.ts
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] EXPO_PUBLIC_SUPABASE_URL ou EXPO_PUBLIC_SUPABASE_ANON_KEY manquants.\n" +
      "Vérifie ton fichier .env et relance Expo après modification."
  );
}

const AsyncStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let cachedStorage:
  | StorageAdapter
  | null = null;

const resolveStorage = async () => {
  if (cachedStorage) return cachedStorage;
  if (Platform.OS !== "web") {
    try {
      const SecureStore = await import("expo-secure-store");
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        cachedStorage = {
          getItem: (key: string) => SecureStore.getItemAsync(key),
          setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
          removeItem: (key: string) => SecureStore.deleteItemAsync(key),
        };
        return cachedStorage;
      }
    } catch {
      // fall through to AsyncStorage
    }
  }
  cachedStorage = AsyncStorageAdapter;
  return cachedStorage;
};

const SupabaseStorage = {
  getItem: (key: string) => resolveStorage().then((storage) => storage.getItem(key)),
  setItem: (key: string, value: string) =>
    resolveStorage().then((storage) => storage.setItem(key, value)),
  removeItem: (key: string) => resolveStorage().then((storage) => storage.removeItem(key)),
};

export const supabase = createClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
  {
    auth: {
      storage: SupabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

