import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { messageOf } from '@/domain/errors';
import { Button, LoadingBlock, Notice, Screen, Title } from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

/** Magic-link landing: shelfly://auth/callback?code=… (Supabase PKCE) or ?token=… (demo inbox). */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; token_hash?: string; code?: string }>();
  const { consumeMagicLink } = useWorkspace();
  const token = params.code || params.token_hash || params.token;
  const [error, setError] = useState<string | null>(token ? null : 'That link is missing its sign-in code.');
  // A link works once. Guard against the effect running again when the session changes mid-flight.
  const consumed = useRef<string | null>(null);

  useEffect(() => {
    if (!token || consumed.current === token) return;
    consumed.current = String(token);
    consumeMagicLink(String(token))
      .then(() => router.replace('/home'))
      .catch((reason: unknown) => setError(messageOf(reason, 'That link could not be opened.')));
  }, [consumeMagicLink, token]);

  return (
    <Screen>
      <Title>Signing you in</Title>
      {error ? (
        <>
          <Notice tone="danger">{error}</Notice>
          <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <LoadingBlock label="Checking the magic link" />
      )}
    </Screen>
  );
}
