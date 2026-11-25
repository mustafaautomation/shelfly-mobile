import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DEMO_ACCOUNTS } from '@/data/demoAccounts';
import { messageOf } from '@/domain/errors';
import { Avatar, Body, Card, Label, Notice, Pill, Screen, Small, StackHeader, Title } from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function DemoScreen() {
  const { enterDemo, mode } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <Screen testID="demo">
      <StackHeader title="Try the demo" subtitle="Six real seats, two workspaces" fallback="/" />
      <Title>Pick a seat</Title>
      <Body>
        Northwind roasts coffee in Oakland. Harbor sells auto parts in Detroit. Each seat sees only its own
        shelves, and what you can change depends on the role.
      </Body>
      {mode === 'supabase' ? (
        <Notice tone="warn">Demo seats are off while this build is connected to Supabase. Sign in with your account.</Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {DEMO_ACCOUNTS.map((account) => (
        <Card
          key={account.userId}
          label={`${account.workspace}, ${account.name}, ${account.roleLabel}`}
          testID={`demo-${account.userId}`}
          onPress={() => {
            if (mode === 'supabase' || busy) return;
            setBusy(account.userId);
            setError(null);
            enterDemo(account.userId)
              .then(() => router.replace('/home'))
              .catch((reason: unknown) => {
                setError(messageOf(reason, 'That demo seat did not open.'));
                setBusy(null);
              });
          }}
        >
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Avatar name={account.name} size={42} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label>{account.name}</Label>
              <Small>{account.workspace}</Small>
            </View>
            <Pill label={account.roleLabel} tone={account.roleLabel === 'Viewer' ? 'neutral' : account.roleLabel === 'Warehouse staff' ? 'primary' : 'forest'} />
          </View>
          <Body>{busy === account.userId ? 'Opening…' : account.detail}</Body>
        </Card>
      ))}
    </Screen>
  );
}
