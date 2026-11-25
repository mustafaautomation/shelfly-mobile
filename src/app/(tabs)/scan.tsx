import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { canWrite } from '@/domain/access';
import { messageOf } from '@/domain/errors';
import { formatCount, formatRelative } from '@/domain/format';
import type { ItemSummary, LookupResult } from '@/domain/types';
import { ScanPanel, type DemoCode } from '@/ui/ScanPanel';
import {
  Button,
  Card,
  Code,
  Eyebrow,
  Label,
  ListCard,
  ListRow,
  LockedNote,
  Notice,
  Pill,
  Qty,
  Screen,
  SectionHeader,
  Small,
  StockBar,
  Title,
} from '@/ui/components';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

interface ScanEntry {
  code: string;
  at: string;
  result: LookupResult;
}

/** Picks a few real barcodes from the active workspace so the web preview can "scan" them. */
function demoCodesFor(items: ItemSummary[]): DemoCode[] {
  const picks = ['NW-PK-12', 'NW-RT-ETH', 'NW-SP-OAT', 'HB-OL-530', 'HB-BR-CIV', 'HB-FL-PH'];
  return items
    .filter((item) => picks.includes(item.sku))
    .slice(0, 3)
    .map((item) => ({ label: item.name, code: item.barcode }));
}

export default function ScanScreen() {
  const { actor, repo, revision, mode } = useWorkspace();
  const items = useAsync(() => repo.listItems(), [actor?.activeTenantId]);
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = history[0];
  const writer = canWrite(actor?.role);
  const currentCode = current?.code;

  // After an adjustment or transfer elsewhere, refresh the on-hand shown for the last scan.
  useEffect(() => {
    if (!currentCode || revision === 0) return;
    let cancelled = false;
    repo
      .lookupCode(currentCode)
      .then((result) => {
        if (!cancelled) setHistory((previous) => (previous[0]?.code === currentCode ? [{ ...previous[0], result }, ...previous.slice(1)] : previous));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Only the revision should trigger this refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const lookup = (code: string) => {
    setBusy(true);
    setError(null);
    repo
      .lookupCode(code)
      .then((result) => setHistory((previous) => [{ code, at: new Date().toISOString(), result }, ...previous].slice(0, 8)))
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Screen testID="scan">
      <Eyebrow>Look up</Eyebrow>
      <Title>Scan a label</Title>
      <ScanPanel onCode={lookup} busy={busy} demoCodes={mode === 'mock' ? demoCodesFor(items.data ?? []) : undefined} />
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {current ? (
        current.result.kind === 'item' ? (
          <Card testID="scan-result">
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Label>{current.result.item.name}</Label>
                <Code>
                  {current.result.item.sku} · {current.result.item.barcode}
                </Code>
              </View>
              <Qty value={formatCount(current.result.item.onHand)} unit={current.result.item.unit} tone={current.result.item.low ? 'danger' : undefined} />
            </View>
            <StockBar onHand={current.result.item.onHand} reorderPoint={current.result.item.reorderPoint} />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {current.result.item.low ? <Pill label="Low stock" tone="danger" /> : <Pill label="In stock" tone="good" />}
              <Small>
                Reorder at {formatCount(current.result.item.reorderPoint)} · in {current.result.item.locationCount} {current.result.item.locationCount === 1 ? 'location' : 'locations'}
              </Small>
            </View>
            <Button label="Open item" icon="cube-outline" variant="secondary" onPress={() => current.result.kind === 'item' && router.push(`/item/${current.result.item.id}`)} />
            {writer ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Adjust" icon="swap-vertical" onPress={() => current.result.kind === 'item' && router.push(`/stock/${current.result.item.id}?mode=adjust`)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Transfer" icon="git-compare-outline" variant="forest" onPress={() => current.result.kind === 'item' && router.push(`/stock/${current.result.item.id}?mode=transfer`)} />
                </View>
              </View>
            ) : (
              <LockedNote role={actor?.role} />
            )}
          </Card>
        ) : (
          <Notice tone="danger" icon="help-circle">
            {current.result.message} Check the label, or search the catalog by name.
          </Notice>
        )
      ) : (
        <Notice tone="neutral" icon="barcode-outline">
          Point the camera at a UPC, EAN, Code 128 or a Shelfly shelf label. The item and its stock show up here.
        </Notice>
      )}

      {history.length > 1 ? (
        <>
          <SectionHeader title="This session" action={{ label: 'Clear', onPress: () => setHistory(history.slice(0, 1)) }} />
          <ListCard>
            {history.slice(1).map((entry) => (
              <ListRow
                key={`${entry.code}-${entry.at}`}
                title={entry.result.kind === 'item' ? entry.result.item.name : 'Not found'}
                subtitle={`${entry.code} · ${formatRelative(entry.at)}`}
                onPress={entry.result.kind === 'item' ? () => entry.result.kind === 'item' && router.push(`/item/${entry.result.item.id}`) : undefined}
                right={entry.result.kind === 'item' ? <Qty value={formatCount(entry.result.item.onHand)} unit={entry.result.item.unit} /> : <Pill label="Unknown" tone="danger" />}
              />
            ))}
          </ListCard>
        </>
      ) : null}
    </Screen>
  );
}
