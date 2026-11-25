import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { planLabel, roleLabel } from '@/domain/access';
import { messageOf } from '@/domain/errors';
import { presentLocalAlert } from '@/notifications/push';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import type { ThemePreference } from '@/theme/tokens';
import {
  Avatar,
  Body,
  Button,
  Card,
  Label,
  ListCard,
  ListRow,
  Notice,
  Pill,
  Screen,
  SectionHeader,
  Segmented,
  Small,
  Title,
} from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function MoreScreen() {
  const { actor, memberships, activeWorkspace, mode, push, enablePush, switchWorkspace, signOut, repo, commit } = useWorkspace();
  const { preference, setPreference } = useShelflyTheme();
  const [notice, setNotice] = useState<{ tone: 'good' | 'danger' | 'neutral'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const run = (key: string, work: () => Promise<string | void>) => {
    setBusy(key);
    setNotice(null);
    work()
      .then((text) => {
        if (text) setNotice({ tone: 'good', text });
      })
      .catch((reason: unknown) => setNotice({ tone: 'danger', text: messageOf(reason) }))
      .finally(() => setBusy(null));
  };

  if (!actor) return null;

  return (
    <Screen testID="more">
      <Title>More</Title>
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Avatar name={actor.name} size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <Label>{actor.name}</Label>
            <Small>{actor.email}</Small>
            {actor.title ? <Small>{actor.title}</Small> : null}
          </View>
          <Pill label={roleLabel(actor.role)} tone="forest" />
        </View>
      </Card>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <SectionHeader title="Workspace" />
      <ListCard>
        {memberships.map((seat) => {
          const active = seat.tenantId === activeWorkspace?.tenantId;
          return (
            <ListRow
              key={seat.tenantId}
              title={seat.tenantName}
              subtitle={`${roleLabel(seat.role)} · ${planLabel(seat.plan)} · ${seat.industry}`}
              label={active ? `${seat.tenantName}, current workspace` : `Switch to ${seat.tenantName}`}
              onPress={
                active
                  ? undefined
                  : () =>
                      run(`switch-${seat.tenantId}`, async () => {
                        await switchWorkspace(seat.tenantId);
                        router.replace('/home');
                      })
              }
              right={active ? <Pill label="Current" tone="good" icon="checkmark" /> : busy === `switch-${seat.tenantId}` ? <Small>Switching…</Small> : null}
            />
          );
        })}
      </ListCard>
      {memberships.length < 2 ? <Small>One workspace on this account. An owner can invite you to another from the web app.</Small> : null}

      <SectionHeader title="Floor tools" />
      <ListCard>
        <ListRow title="Stock by location" subtitle="Every warehouse and bin with units and value" onPress={() => router.push('/locations')} />
        <ListRow title="Movement ledger" subtitle="Receipts, adjustments and transfers, newest first" onPress={() => router.push('/activity')} />
        <ListRow title="Scan a barcode" subtitle="Camera on the phone, typed codes on the web" onPress={() => router.push('/scan')} />
      </ListCard>

      <SectionHeader title="Appearance" />
      <Segmented<ThemePreference>
        label="Appearance"
        value={preference}
        onChange={setPreference}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />

      <SectionHeader title="Low-stock notifications" />
      <Card>
        <Body>
          {push
            ? push.detail
            : 'Get a notification when a SKU you move drops to its reorder point. Tapping it opens the item.'}
        </Body>
        {push ? <Pill label={push.mode === 'device' ? 'Push on' : 'Local alerts'} tone={push.mode === 'device' ? 'good' : 'primary'} /> : null}
        <Button
          label={push ? 'Check again' : 'Turn on alerts'}
          icon="notifications-outline"
          variant="secondary"
          busy={busy === 'push'}
          onPress={() => run('push', async () => (await enablePush()).detail)}
        />
        <Button
          label="Send a test alert"
          icon="paper-plane-outline"
          variant="ghost"
          busy={busy === 'test'}
          onPress={() =>
            run('test', async () => {
              const alerts = await repo.listAlerts();
              const sample = alerts.find((alert) => !alert.read) ?? alerts[0];
              const title = sample ? `Low stock: ${sample.sku}` : 'Shelfly test alert';
              const body = sample ? sample.message : 'Low-stock alerts will look like this.';
              const shown = await presentLocalAlert(title, body, sample ? `/item/${sample.productId}` : '/alerts');
              if (shown) return 'Test alert sent. Tap it to open the item.';
              return Platform.OS === 'web'
                ? `The web preview cannot show system notifications. On the phone this would read “${title}”.`
                : 'Notifications are off for Shelfly. Turn them on in Settings to see the test.';
            })
          }
        />
      </Card>

      <SectionHeader title="Data" />
      <Card>
        <Body>
          {mode === 'mock'
            ? 'Demo books on this device: Northwind Coffee Roasters and Harbor Auto Parts. Changes stay on this device until you reset them.'
            : 'Connected to your Shelfly Supabase project. Row level security decides what this seat can read and change.'}
        </Body>
        <Pill label={mode === 'mock' ? 'Demo mode' : 'Supabase'} tone={mode === 'mock' ? 'primary' : 'good'} />
        {mode === 'mock' ? (
          confirmReset ? (
            <View style={{ gap: 8 }}>
              <Notice tone="warn">This puts every count, order and alert back to the original demo books.</Notice>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Cancel" variant="secondary" onPress={() => setConfirmReset(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Reset"
                    variant="danger"
                    busy={busy === 'reset'}
                    onPress={() =>
                      run('reset', async () => {
                        await commit(() => repo.resetDemo());
                        setConfirmReset(false);
                        return 'Demo books are back to the start.';
                      })
                    }
                  />
                </View>
              </View>
            </View>
          ) : (
            <Button label="Reset demo books" variant="ghost" icon="refresh" onPress={() => setConfirmReset(true)} />
          )
        ) : null}
      </Card>

      <Button
        label="Sign out"
        variant="secondary"
        icon="log-out-outline"
        busy={busy === 'signout'}
        onPress={() =>
          run('signout', async () => {
            await signOut();
            router.replace('/');
          })
        }
      />
      <Small style={{ textAlign: 'center' }}>
        Shelfly {Constants.expoConfig?.version ?? '1.0.0'} · com.quvantic.shelfly
      </Small>
    </Screen>
  );
}
