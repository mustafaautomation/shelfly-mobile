import type { DataMode } from '@/domain/types';

export interface PublicEnv {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
}

/** Supabase only when both public values are present. Anything else runs the on-device demo. */
export function resolveDataMode(env: PublicEnv): DataMode {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? 'supabase' : 'mock';
}

export function readPublicEnv(): PublicEnv {
  // Expo inlines EXPO_PUBLIC_* only for direct property access, so read them one by one.
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}
