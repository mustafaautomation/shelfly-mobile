import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { canWrite } from '@/domain/access';
import { messageOf } from '@/domain/errors';
import { formatCount, formatSigned } from '@/domain/format';
import type { ItemDetail, StockAction, StockResult } from '@/domain/types';
import { presentLocalAlert } from '@/notifications/push';
import {
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  Label,
  LockedNote,
  Notice,
  QtyStepper,
  QueryState,
  Screen,
  Segmented,
  Small,
  StackHeader,
  TextField,
  Title,
  goBack,
} from '@/ui/components';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

type Mode = 'adjust' | 'transfer' | 'receive';
type Direction = 'remove' | 'add';

const REASONS: Record<Direction, string[]> = {
  remove: ['Damaged', 'Cycle count', 'Used in production', 'Sold at the counter', 'Expired'],
  add: ['Cycle count', 'Found on another shelf', 'Customer return', 'Production output'],
};

function StockForm({ item, initialMode, initialLocation }: { item: ItemDetail; initialMode: Mode; initialLocation?: string }) {
  const { repo, commit } = useWorkspace();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [direction, setDirection] = useState<Direction>('remove');
  const stocked = item.byLocation.filter((row) => row.qty > 0);
  const firstStocked = stocked[0]?.locationId ?? item.byLocation[0]?.locationId ?? '';
  const [locationId, setLocationId] = useState(initialLocation ?? firstStocked);
  const [toChoice, setToLocationId] = useState('');
  // The destination can never be the source.
  const toLocationId = toChoice === locationId ? '' : toChoice;
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ result: StockResult; summary: string } | null>(null);

  const here = item.byLocation.find((row) => row.locationId === locationId);
  const destination = item.byLocation.find((row) => row.locationId === toLocationId);
  const transferTargets = item.byLocation.filter((row) => row.locationId !== locationId);


  const delta = mode === 'adjust' ? (direction === 'remove' ? -qty : qty) : qty;
  const nextHere = (here?.qty ?? 0) + (mode === 'transfer' ? -qty : delta);
  const nextTotal = item.onHand + (mode === 'transfer' ? 0 : delta);
  const crossesReorder = !item.low && nextTotal <= item.reorderPoint && mode !== 'transfer';

  const preview = useMemo(() => {
    if (!here) return null;
    if (mode === 'transfer') {
      return destination
        ? `${here.locationName} ${formatCount(here.qty)} → ${formatCount(nextHere)}, ${destination.locationName} ${formatCount(destination.qty)} → ${formatCount(destination.qty + qty)}`
        : null;
    }
    return `${here.locationName}: ${formatCount(here.qty)} → ${formatCount(nextHere)} ${item.unit}`;
  }, [destination, here, item.unit, mode, nextHere, qty]);

  const problem =
    !locationId
      ? 'Choose a location.'
      : mode === 'transfer' && !toLocationId
        ? 'Choose where the stock goes.'
        : mode === 'transfer' && here && qty > here.qty
          ? `Only ${formatCount(here.qty)} ${item.unit} at ${here.locationName}.`
          : mode === 'adjust' && !reason.trim()
            ? 'Every adjustment needs a reason on the ledger.'
            : null;

  const submit = () => {
    if (problem) {
      setError(problem);
      return;
    }
    const action: StockAction =
      mode === 'adjust'
        ? { type: 'adjust', productId: item.id, locationId, delta, reason: reason.trim() }
        : mode === 'transfer'
          ? { type: 'transfer', productId: item.id, fromLocationId: locationId, toLocationId, qty, reason: reason.trim() }
          : { type: 'receive', productId: item.id, locationId, qty, reason: reason.trim() };
    setBusy(true);
    setError(null);
    commit(() => repo.applyStock(action))
      .then((result) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        if (result.newAlert) {
          void presentLocalAlert(`Low stock: ${result.newAlert.sku}`, result.newAlert.message, `/item/${item.id}`);
        }
        const summary =
          mode === 'transfer'
            ? `Moved ${formatCount(qty)} ${item.unit} from ${here?.locationName} to ${destination?.locationName}.`
            : mode === 'receive'
              ? `Received ${formatCount(qty)} ${item.unit} into ${here?.locationName}.`
              : `Adjusted ${here?.locationName} by ${formatSigned(delta)} ${item.unit}: ${reason.trim()}.`;
        setDone({ result, summary });
      })
      .catch((reason: unknown) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setError(messageOf(reason, 'The change was not saved.'));
      })
      .finally(() => setBusy(false));
  };

  if (done) {
    return (
      <Screen testID="stock-done">
        <StackHeader title={item.name} subtitle={item.sku} fallback={`/item/${item.id}`} />
        <Title>Posted</Title>
        <Notice tone="good">{done.summary}</Notice>
        <Card>
          <Small>On hand now</Small>
          <Label style={{ fontSize: 28, lineHeight: 34 }}>
            {formatCount(done.result.onHand)} {item.unit}
          </Label>
          <Small>Written to the movement ledger by you, {new Date(done.result.movement.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</Small>
        </Card>
        {done.result.newAlert ? (
          <Notice tone="danger" icon="notifications">
            {item.name} is now at or below its reorder point. A low-stock alert is open for the team.
          </Notice>
        ) : null}
        <Button label="Back to item" onPress={() => router.dismissTo(`/item/${item.id}`)} />
        <Button label="Scan the next label" variant="secondary" icon="scan-outline" onPress={() => router.dismissTo('/scan')} />
        <Button
          label="Make another change"
          variant="ghost"
          onPress={() => {
            setDone(null);
            setQty(1);
            setReason('');
          }}
        />
      </Screen>
    );
  }

  const submitLabel =
    mode === 'adjust'
      ? `Post ${formatSigned(delta)} ${item.unit}`
      : mode === 'transfer'
        ? `Move ${formatCount(qty)} ${item.unit}`
        : `Receive ${formatCount(qty)} ${item.unit}`;

  return (
    <Screen
      testID="stock"
      footer={
        <>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button label={submitLabel} busy={busy} onPress={submit} testID="submit-stock" icon="checkmark" />
        </>
      }
    >
      <StackHeader title={item.name} subtitle={`${item.sku} · ${formatCount(item.onHand)} ${item.unit} on hand`} fallback={`/item/${item.id}`} />
      <Segmented<Mode>
        label="Stock change"
        value={mode}
        onChange={(next) => {
          setMode(next);
          setError(null);
          // Transfers start from a shelf that has stock.
          if (next === 'transfer' && !(here && here.qty > 0)) setLocationId(firstStocked);
        }}
        options={[
          { value: 'adjust', label: 'Adjust' },
          { value: 'transfer', label: 'Transfer' },
          { value: 'receive', label: 'Receive' },
        ]}
      />

      <Label>{mode === 'transfer' ? 'From' : mode === 'receive' ? 'Into' : 'Location'}</Label>
      <ChipRow>
        {(mode === 'transfer' ? stocked : item.byLocation).map((row) => (
          <Chip
            key={row.locationId}
            label={row.locationName}
            sub={`${row.locationCode} · ${formatCount(row.qty)} ${item.unit}`}
            selected={row.locationId === locationId}
            accessibilityLabel={`${mode === 'transfer' ? 'From' : 'At'} ${row.locationName}`}
            onPress={() => setLocationId(row.locationId)}
          />
        ))}
      </ChipRow>
      {mode === 'transfer' && stocked.length === 0 ? <Notice tone="neutral">Nothing on the shelves to move.</Notice> : null}

      {mode === 'transfer' ? (
        <>
          <Label>To</Label>
          <ChipRow>
            {transferTargets.map((row) => (
              <Chip
                key={row.locationId}
                label={row.locationName}
                sub={`${row.locationCode} · ${formatCount(row.qty)} ${item.unit}`}
                selected={row.locationId === toLocationId}
                accessibilityLabel={`To ${row.locationName}`}
                onPress={() => setToLocationId(row.locationId)}
              />
            ))}
          </ChipRow>
        </>
      ) : null}

      {mode === 'adjust' ? (
        <Segmented<Direction>
          label="Direction"
          value={direction}
          onChange={(next) => {
            setDirection(next);
            setReason('');
          }}
          options={[
            { value: 'remove', label: 'Remove' },
            { value: 'add', label: 'Add' },
          ]}
        />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <QtyStepper
          label="Quantity"
          value={qty}
          onChange={setQty}
          min={1}
          max={mode === 'transfer' ? Math.max(1, here?.qty ?? 1) : undefined}
          testID="qty"
        />
        <Body>{item.unit}</Body>
      </View>

      {mode === 'adjust' ? (
        <>
          <Label>Reason</Label>
          <ChipRow>
            {REASONS[direction].map((preset) => (
              <Chip key={preset} label={preset} selected={reason === preset} onPress={() => setReason(preset)} />
            ))}
          </ChipRow>
        </>
      ) : null}
      <TextField
        label={mode === 'adjust' ? 'Reason for the ledger' : 'Note (optional)'}
        value={reason}
        onChangeText={setReason}
        placeholder={mode === 'adjust' ? 'Damaged in transit, cycle count…' : mode === 'transfer' ? 'Replenish the pick face' : 'Walk-in delivery, packing slip 883'}
        autoCapitalize="sentences"
        testID="reason"
      />

      {preview ? <Notice tone="neutral" icon="eye-outline">{preview}</Notice> : null}
      {mode === 'adjust' && nextHere < 0 ? (
        <Notice tone="warn">This takes {here?.locationName} below zero. Shelfly allows it with a reason, so the count can be fixed later.</Notice>
      ) : null}
      {crossesReorder ? (
        <Notice tone="warn">This puts {item.name} at or below its reorder point of {formatCount(item.reorderPoint)}. A low-stock alert will open.</Notice>
      ) : null}
    </Screen>
  );
}

export default function StockScreen() {
  const { id, mode, location } = useLocalSearchParams<{ id: string; mode?: string; location?: string }>();
  const { actor, repo } = useWorkspace();
  // Load once: the form keeps its own state, and a refresh mid-edit would reset the chosen shelf.
  const item = useAsync(() => repo.getItem(String(id)), [id, actor?.activeTenantId]);
  const initialMode: Mode = mode === 'transfer' || mode === 'receive' ? mode : 'adjust';

  if (!canWrite(actor?.role)) {
    return (
      <Screen>
        <StackHeader title="Stock change" fallback={`/item/${id}`} />
        <LockedNote role={actor?.role} />
        <Button label="Back" variant="secondary" onPress={() => goBack(`/item/${id}`)} />
      </Screen>
    );
  }

  if (!item.data) {
    return (
      <Screen>
        <StackHeader title="Stock change" fallback={`/item/${id}`} />
        <QueryState query={item} loading="Opening the item">
          {() => null}
        </QueryState>
      </Screen>
    );
  }
  return <StockForm item={item.data} initialMode={initialMode} initialLocation={typeof location === 'string' ? location : undefined} />;
}
