import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { canReceive, canWrite, poStatusLabel } from '@/domain/access';
import { codesMatch, normalizeCode } from '@/domain/barcode';
import { messageOf } from '@/domain/errors';
import { formatCount, plural } from '@/domain/format';
import type { PoDetail, ReceiveResult } from '@/domain/types';
import { ScanPanel } from '@/ui/ScanPanel';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  Label,
  LockedNote,
  Notice,
  Pill,
  QtyStepper,
  QueryState,
  Screen,
  SectionHeader,
  Small,
  StackHeader,
  Title,
} from '@/ui/components';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

function ReceiveForm({ po }: { po: PoDetail }) {
  const { repo, commit, mode } = useWorkspace();
  const [locationId, setLocationId] = useState(po.receivingLocations[0]?.id ?? '');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ tone: 'good' | 'danger' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReceiveResult | null>(null);
  const open = po.lines.filter((line) => line.remaining > 0);

  const total = open.reduce((sum, line) => sum + (counts[line.id] ?? 0), 0);
  const willClose = open.every((line) => (counts[line.id] ?? 0) >= line.remaining);

  const scan = (code: string) => {
    const line = po.lines.find((item) => codesMatch(item.barcode, code) || normalizeCode(item.sku) === normalizeCode(code));
    if (!line) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setFeedback({ tone: 'danger', text: `${code} is not on ${po.number}. Set that carton aside.` });
      return;
    }
    const current = counts[line.id] ?? 0;
    if (current >= line.remaining) {
      setFeedback({ tone: 'warn', text: `${line.name} is already at the ${formatCount(line.remaining)} still owed on this order.` });
      return;
    }
    setCounts({ ...counts, [line.id]: current + 1 });
    setFeedback({ tone: 'good', text: `Counted 1 × ${line.name} (${formatCount(current + 1)} of ${formatCount(line.remaining)})` });
  };

  const submit = () => {
    if (!locationId) {
      setError('Choose where the delivery is going.');
      return;
    }
    if (total === 0) {
      setError('Count at least one unit to receive.');
      return;
    }
    setBusy(true);
    setError(null);
    commit(() =>
      repo.receivePurchaseOrder({
        purchaseOrderId: po.id,
        locationId,
        lines: open.map((line) => ({ lineId: line.id, qty: counts[line.id] ?? 0 })).filter((line) => line.qty > 0),
      }),
    )
      .then((result) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setDone(result);
      })
      .catch((reason: unknown) => setError(messageOf(reason, 'The receipt was not saved.')))
      .finally(() => setBusy(false));
  };

  if (done) {
    const location = po.receivingLocations.find((item) => item.id === locationId);
    return (
      <Screen testID="receive-done">
        <StackHeader title={`Receive ${po.number}`} fallback={`/po/${po.id}`} />
        <Title>{done.order.status === 'received' ? 'Order complete' : 'Partial receipt posted'}</Title>
        <Notice tone="good">
          {formatCount(done.unitsReceived)} units are on the shelf at {location?.name}. {po.number} is now {poStatusLabel(done.order.status).toLowerCase()}
          {done.order.status === 'partial' ? `, with ${formatCount(done.order.ordered - done.order.received)} still to come.` : '.'}
        </Notice>
        <Button label="Back to the order" onPress={() => router.dismissTo(`/po/${po.id}`)} />
        <Button label="All orders" variant="secondary" onPress={() => router.dismissTo('/orders')} />
      </Screen>
    );
  }

  return (
    <Screen
      testID="receive"
      footer={
        <>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Small>
            {total === 0
              ? 'Scan cartons or set counts below.'
              : `${formatCount(total)} units on ${plural(open.filter((line) => (counts[line.id] ?? 0) > 0).length, 'line')} · order will be ${willClose ? 'received in full' : 'partial'}`}
          </Small>
          <Button label={total === 0 ? 'Post receipt' : `Post receipt of ${formatCount(total)}`} icon="checkmark" busy={busy} disabled={total === 0} onPress={submit} testID="post-receipt" />
        </>
      }
    >
      <StackHeader title={`Receive ${po.number}`} subtitle={`${po.supplierName} → ${po.warehouseName}`} fallback={`/po/${po.id}`} />

      <Label>Put away at</Label>
      <ChipRow>
        {po.receivingLocations.map((location) => (
          <Chip
            key={location.id}
            label={location.name}
            sub={location.code}
            selected={location.id === locationId}
            accessibilityLabel={`Receive into ${location.name}`}
            onPress={() => setLocationId(location.id)}
          />
        ))}
      </ChipRow>

      <SectionHeader title="Scan to count" />
      <ScanPanel
        onCode={scan}
        continuous
        submitLabel="Count"
        placeholder="Carton barcode"
        demoCodes={mode === 'mock' ? open.map((line) => ({ label: line.name, code: line.barcode })) : undefined}
      />
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}

      <SectionHeader
        title="Lines"
        action={{
          label: 'Fill all remaining',
          onPress: () => {
            setCounts(Object.fromEntries(open.map((line) => [line.id, line.remaining])));
            setFeedback(null);
          },
        }}
      />
      {open.map((line) => (
        <Card key={line.id}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label>{line.name}</Label>
              <Small>
                {line.sku} · {formatCount(line.qtyReceived)} of {formatCount(line.qtyOrdered)} in · {formatCount(line.remaining)} {line.unit} still owed
              </Small>
            </View>
            {(counts[line.id] ?? 0) >= line.remaining ? <Pill label="Full" tone="good" /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <QtyStepper
              label={`Receive ${line.name}`}
              value={counts[line.id] ?? 0}
              onChange={(value) => setCounts({ ...counts, [line.id]: value })}
              min={0}
              max={line.remaining}
            />
            <Button compact variant="ghost" label={`All ${formatCount(line.remaining)}`} accessibilityLabel={`Receive all ${line.name}`} onPress={() => setCounts({ ...counts, [line.id]: line.remaining })} />
          </View>
        </Card>
      ))}
      {po.lines.length > open.length ? <Small>{plural(po.lines.length - open.length, 'line')} on this order already arrived in full.</Small> : null}
    </Screen>
  );
}

export default function ReceiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actor, repo } = useWorkspace();
  const po = useAsync(() => repo.getPurchaseOrder(String(id)), [id, actor?.activeTenantId]);

  if (!canWrite(actor?.role)) {
    return (
      <Screen>
        <StackHeader title="Receive" fallback={`/po/${id}`} />
        <LockedNote role={actor?.role} />
      </Screen>
    );
  }
  if (!po.data) {
    return (
      <Screen>
        <StackHeader title="Receive" fallback={`/po/${id}`} />
        <QueryState query={po} loading="Opening the order">
          {() => null}
        </QueryState>
      </Screen>
    );
  }
  if (!canReceive(po.data.status)) {
    return (
      <Screen>
        <StackHeader title={`Receive ${po.data.number}`} fallback={`/po/${id}`} />
        <Notice tone="neutral">
          {po.data.status === 'draft' ? 'Send this order to the supplier before receiving it.' : 'This order is already received in full.'}
        </Notice>
        <Button label="Back to the order" variant="secondary" onPress={() => router.replace(`/po/${id}`)} />
      </Screen>
    );
  }
  return <ReceiveForm po={po.data} />;
}
