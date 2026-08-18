import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@barangayan/shared';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy ' +
      'apps/resident-android-mobile/.env.example to apps/resident-android-mobile/.env and fill in your Supabase project values.',
  );
}

/** The one Supabase client for the mobile app — session persisted via AsyncStorage. */
export const supabase = createSupabaseClient({
  url,
  anonKey,
  authStorage: AsyncStorage,
});
