import { resolveDataMode } from '@/data/mode';

describe('data mode', () => {
  it('runs the demo with no env vars or with only one of them', () => {
    expect(resolveDataMode({})).toBe('mock');
    expect(resolveDataMode({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toBe('mock');
    expect(resolveDataMode({ EXPO_PUBLIC_SUPABASE_URL: '  ', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'key' })).toBe('mock');
  });

  it('uses Supabase when both public values are set', () => {
    expect(resolveDataMode({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toBe('supabase');
  });
});
