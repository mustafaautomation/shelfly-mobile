import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { canReceive, canWrite, poStatusLabel } from '@/domain/access';
import { messageOf } from '@/domain/errors';
import { formatCount, formatDay, formatDue, formatMoney, plural } from '@/domain/format';
import {
  Body,
  Button,
  Card,
  Code,
  Label,
  ListCard,
  ListRow,
  LockedNote,
  Notice,
  Pill,
  ProgressBar,
  QueryState,
  Screen,
  SectionHeader,
  Small,
  StackHeader,
} from '@/ui/components';
import { poTone } from '@/ui/rows';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function PurchaseOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actor, repo, revision, commit } = useWorkspace();
  const po = useAsync(() => repo.getPurchaseOrder(String(id)), [id, actor?.activeTenantId, revision]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'danger'; text: string } | null>(null);
  const writer = canWrite(actor?.role);

  return (
    <Screen testID="po">
      <StackHeader title={po.data?.number ?? 'Purchase order'} subtitle={po.data?.supplierName} fallback="/orders" />
      <QueryState query={po} loading="Opening the order">
        {(data) => (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Label style={{ flex: 1 }}>
                  {data.supplierName} → {data.warehouseName}
                </Label>
                <Pill label={poStatusLabel(data.status)} tone={poTone(data.status)} />
              </View>
              <ProgressBar value={data.ordered ? data.received / data.ordered : 0} tone={data.status === 'received' ? 'good' : 'forest'} label="Received so far" />
              <Small>
                {formatCount(data.received)} of {formatCount(data.ordered)} units received · {plural(data.lineCount, 'line')} · {formatMoney(data.totalCents)}
              </Small>
              <Small>
                {data.status === 'received' ? `Closed ${formatDay(data.updatedAt)}` : data.expectedOn ? `${formatDue(data.expectedOn)} (${formatDay(data.expectedOn)})` : 'No expected date'}
              </Small>
            </Card>

            {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

            {!writer ? (
              <LockedNote role={actor?.role} />
            ) : data.status === 'draft' ? (
              <>
                <Notice tone="neutral">A draft has not gone to the supplier. Send it, then receive it here when the truck shows up.</Notice>
                <Button
                  label="Mark as sent to supplier"
                  icon="paper-plane-outline"
                  busy={busy}
                  onPress={() => {
                    setBusy(true);
                    commit(() => repo.sendPurchaseOrder(data.id))
                      .then(() => setMessage({ tone: 'good', text: `${data.number} is marked as sent. It is now open for receiving.` }))
                      .catch((reason: unknown) => setMessage({ tone: 'danger', text: messageOf(reason) }))
                      .finally(() => setBusy(false));
                  }}
                />
              </>
            ) : canReceive(data.status) ? (
              <Button label="Receive delivery" icon="download-outline" onPress={() => router.push(`/receive/${data.id}`)} testID="receive-po" />
            ) : (
              <Notice tone="good">Every line on this order is on the shelf.</Notice>
            )}

            <SectionHeader title="Lines" />
            <ListCard>
              {data.lines.map((line) => (
                <ListRow
                  key={line.id}
                  title={line.name}
                  subtitle={`${line.sku} · ${formatMoney(line.unitCostCents)} each`}
                  onPress={() => router.push(`/item/${line.productId}`)}
                  label={`${line.name}, ${line.qtyReceived} of ${line.qtyOrdered} received`}
                  right={
                    <View style={{ alignItems: 'flex-end' }}>
                      <Label>
                        {formatCount(line.qtyReceived)}/{formatCount(line.qtyOrdered)}
                      </Label>
                      <Small>{line.remaining > 0 ? `${formatCount(line.remaining)} to go` : 'complete'}</Small>
                    </View>
                  }
                >
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar value={line.qtyOrdered ? line.qtyReceived / line.qtyOrdered : 0} tone={line.remaining === 0 ? 'good' : 'forest'} />
                  </View>
                </ListRow>
              ))}
            </ListCard>

            {data.notes ? (
              <>
                <SectionHeader title="Notes" />
                <Body>{data.notes}</Body>
              </>
            ) : null}

            <SectionHeader title="Supplier" />
            <Card>
              <Label>{data.supplierName}</Label>
              {data.supplierEmail ? <Code>{data.supplierEmail}</Code> : null}
              {data.supplierPhone ? <Code>{data.supplierPhone}</Code> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {data.supplierEmail ? (
                  <Button compact label="Email" icon="mail-outline" variant="secondary" onPress={() => void Linking.openURL(`mailto:${data.supplierEmail}?subject=${encodeURIComponent(data.number)}`)} />
                ) : null}
                {data.supplierPhone ? (
                  <Button compact label="Call" icon="call-outline" variant="secondary" onPress={() => void Linking.openURL(`tel:${data.supplierPhone.replace(/[^0-9+]/g, '')}`)} />
                ) : null}
              </View>
            </Card>
          </>
        )}
      </QueryState>
    </Screen>
  );
}
