import { router } from 'expo-router';
import { useState } from 'react';

import { messageOf } from '@/domain/errors';
import { Body, Button, Notice, Screen, StackHeader, TextField, Title } from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function MagicLinkScreen() {
  const { requestMagicLink, mode } = useWorkspace();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [demoPath, setDemoPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen testID="magic">
      <StackHeader title="Magic link" fallback="/" />
      <Title>No password needed</Title>
      <Body>We email a one-time link. Open it on this phone and Shelfly signs you in.</Body>
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="floor@northwind.demo" keyboardType="email-address" />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label="Send magic link"
        icon="paper-plane-outline"
        busy={busy}
        onPress={() => {
          if (!email.includes('@')) {
            setError('Enter the email on your Shelfly seat.');
            return;
          }
          setBusy(true);
          setError(null);
          requestMagicLink(email)
            .then((result) => {
              setSent(true);
              setDemoPath(result.demoPath);
            })
            .catch((reason: unknown) => setError(messageOf(reason, 'The link could not be sent.')))
            .finally(() => setBusy(false));
        }}
      />
      {sent ? (
        <Notice tone="good">
          If that address has a Shelfly seat, the link is on its way. Unknown addresses get the same message, so this
          screen never confirms who works here.
        </Notice>
      ) : null}
      {sent && mode === 'mock' ? (
        demoPath ? (
          <Button label="Open the link from the demo inbox" variant="secondary" icon="mail-open-outline" onPress={() => router.push(demoPath as never)} />
        ) : (
          <Body>Nothing arrived in the demo inbox. Demo seats use the @northwind.demo, @harbor.demo and @shelfly.demo addresses.</Body>
        )
      ) : null}
    </Screen>
  );
}
