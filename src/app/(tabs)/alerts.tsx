import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { canWrite } from '@/domain/access';
import { messageOf } from '@/domain/errors';
import { formatCount, formatRelative } from '@/domain/format';
import type { AlertView } from '@/domain/types';
import { Body, Button, Card, Eyebrow, Label, Notice, Pill, QueryState, Screen, SectionHeader, Small, StockBar, Title } from '@/ui/components';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

function AlertCard({ alert, writer, onRead }: { alert: AlertView; writer: boolean; onRead: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card testID={`alert-${alert.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Label style={{ flex: 1 }}>{alert.productName}</Label>
        <Pill label={alert.read ? 'Read' : 'New'} tone={alert.read ? 'neutral' : 'danger'} />
      </View>
      <Small>
        {alert.sku} · {formatCount(alert.onHand)} {alert.unit} on hand now · reorder at {formatCount(alert.reorderPoint)} · {formatRelative(alert.createdAt)}
      </Small>
      <StockBar onHand={alert.onHand} reorderPoint={alert.reorderPoint} />
      <Body>{alert.message}</Body>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button compact label="Open item" icon="cube-outline" variant="secondary" accessibilityLabel={`Open ${alert.productName}`} onPress={() => router.push(`/item/${alert.productId}`)} />
        {writer && !alert.read ? (
          <Button
            compact
            label="Mark read"
            icon="checkmark"
            variant="ghost"
            busy={busy}
            accessibilityLabel={`Mark ${alert.productName} alert read`}
            onPress={() => {
              setBusy(true);
              onRead().finally(() => setBusy(false));
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}

export default function AlertsScreen() {
  const { actor, repo, revision, commit } = useWorkspace();
  const alerts = useAsync(() => repo.listAlerts(), [actor?.activeTenantId, revision]);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const writer = canWrite(actor?.role);

  const run = (work: () => Promise<unknown>) =>
    commit(work)
      .then(() => setError(null))
      .catch((reason: unknown) => setError(messageOf(reason)));

  return (
    <Screen testID="alerts">
      <Eyebrow>Low stock</Eyebrow>
      <Title>Alerts</Title>
      <Body>A SKU lands here the moment its on-hand reaches the reorder point. Owners also get the email from the web app.</Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <QueryState
        query={alerts}
        loading="Checking reorder points"
        isEmpty={(data) => data.length === 0}
        empty={{ title: 'All stocked', body: 'No SKU has hit its reorder point. Alerts appear here when one does.', icon: 'checkmark-done-outline' }}
      >
        {(data) => {
          const unread = data.filter((alert) => !alert.read);
          const read = data.filter((alert) => alert.read);
          return (
            <>
              {unread.length > 0 && writer ? (
                <Button
                  label={`Mark all ${unread.length} read`}
                  variant="secondary"
                  icon="checkmark-done"
                  busy={clearing}
                  onPress={() => {
                    setClearing(true);
                    void run(() => repo.markAllAlertsRead()).finally(() => setClearing(false));
                  }}
                />
              ) : null}
              {!writer ? <Notice tone="neutral" icon="eye-outline">Viewers see alerts but cannot clear them.</Notice> : null}
              {unread.length === 0 ? <Notice tone="good">You are caught up. Nothing new since the last check.</Notice> : null}
              {unread.map((alert) => (
                <AlertCard key={alert.id} alert={alert} writer={writer} onRead={() => run(() => repo.markAlertRead(alert.id))} />
              ))}
              {read.length > 0 ? <SectionHeader title="Earlier" /> : null}
              {read.map((alert) => (
                <AlertCard key={alert.id} alert={alert} writer={writer} onRead={() => run(() => repo.markAlertRead(alert.id))} />
              ))}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}
