import { withReadCache, type CacheFlags } from '@/data/cache';
import { createMockRepository } from '@/data/mockRepository';
import { readPublicEnv, resolveDataMode, type PublicEnv } from '@/data/mode';
import { createDevicePersistence, type Persistence } from '@/data/persistence';
import type { ShelflyRepository } from '@/data/repository';
import { createSupabaseRepository } from '@/data/supabaseRepository';

export interface RepositoryOptions {
  env?: PublicEnv;
  persistence?: Persistence;
  flags?: CacheFlags;
  isOnline?: () => boolean;
  latencyMs?: number;
}

export function createRepository(options: RepositoryOptions = {}): ShelflyRepository {
  const env = options.env ?? readPublicEnv();
  const persistence = options.persistence ?? createDevicePersistence();
  const flags = options.flags ?? { mark() {} };
  const inner =
    resolveDataMode(env) === 'supabase'
      ? createSupabaseRepository(
          { url: env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '', anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '' },
          persistence,
        )
      : createMockRepository({ persistence, latencyMs: options.latencyMs ?? 120 });
  return withReadCache(inner, persistence, flags, options.isOnline);
}
