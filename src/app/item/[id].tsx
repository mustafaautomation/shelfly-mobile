import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { canWrite } from '@/domain/access';
import { formatCount, formatDue, formatMoney, plural } from '@/domain/format';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import {
  Body,
  Button,
  Card,
  Code,
  ListCard,
  ListRow,
  LockedNote,
  Notice,
  Pill,
  QueryState,
  Qty,
  Screen,
  SectionHeader,
  Small,
  StackHeader,
  StockBar,
} from '@/ui/components';
import { MovementRow } from '@/ui/rows';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actor, repo, revision } = useWorkspace();
  const { colors, fontFamily } = useShelflyTheme();
  const item = useAsync(() => repo.getItem(String(id)), [id, actor?.activeTenantId, revision]);
  const writer = canWrite(actor?.role);

  return (
    <Screen testID="item">
      <StackHeader title={item.data?.name ?? 'Item'} subtitle={item.data ? `${item.data.sku} · ${item.data.category}` : undefined} fallback="/items" />
      <QueryState query={item} loading="Finding the SKU">
        {(data) => {
          const stocked = data.byLocation.filter((row) => row.qty !== 0);
          const empty = data.byLocation.length - stocked.length;
          return (
            <>
              <Card>
                <View style={styles.hero}>
                  <View style={{ flex: 1 }}>
                    <Small>On hand</Small>
                    <Text style={[styles.big, { color: data.low ? colors.danger : colors.ink, fontFamily: fontFamily?.display }]} testID="on-hand">
                      {formatCount(data.onHand)}
                      <Text style={[styles.unit, { color: colors.muted, fontFamily: fontFamily?.body }]}> {data.unit}</Text>
                    </Text>
                  </View>
                  {data.low ? <Pill label="Low stock" tone="danger" icon="warning" /> : <Pill label="In stock" tone="good" />}
                </View>
                <StockBar onHand={data.onHand} reorderPoint={data.reorderPoint} />
                <View style={styles.facts}>
                  <Fact label="Reorder at" value={formatCount(data.reorderPoint)} />
                  <Fact label="Unit cost" value={formatMoney(data.costCents)} />
                  <Fact label="Value" value={formatMoney(data.valueCents)} />
                </View>
                <Code>Barcode {data.barcode || 'none'}</Code>
              </Card>

              {data.openAlertId ? (
                <Notice tone="danger" icon="notifications">
                  {data.inbound.length > 0
                    ? `Low-stock alert open. ${formatCount(data.inbound.reduce((sum, line) => sum + line.remaining, 0))} ${data.unit} are already on order.`
                    : 'Low-stock alert open and nothing is on order. Raise a purchase order from the web app.'}
                </Notice>
              ) : null}

              {writer ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button label="Adjust" icon="swap-vertical" onPress={() => router.push(`/stock/${data.id}?mode=adjust`)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label="Transfer" icon="git-compare-outline" variant="forest" onPress={() => router.push(`/stock/${data.id}?mode=transfer`)} />
                    </View>
                  </View>
                  <Button label="Receive without an order" icon="download-outline" variant="secondary" onPress={() => router.push(`/stock/${data.id}?mode=receive`)} />
                </View>
              ) : (
                <LockedNote role={actor?.role} />
              )}

              <SectionHeader title="Where it sits" />
              {stocked.length === 0 ? (
                <Notice tone="neutral">Not on any shelf right now.</Notice>
              ) : (
                <ListCard>
                  {stocked.map((row) => (
                    <ListRow
                      key={row.locationId}
                      title={row.locationName}
                      subtitle={`${row.warehouseName} · ${row.locationCode}`}
                      label={`${row.locationName}, ${row.qty} ${data.unit}`}
                      onPress={() => router.push(`/location/${row.locationId}`)}
                      right={<Qty value={formatCount(row.qty)} unit={data.unit} tone={row.qty < 0 ? 'danger' : undefined} />}
                    />
                  ))}
                </ListCard>
              )}
              {empty > 0 && stocked.length > 0 ? <Small>Empty in {plural(empty, 'other location')}.</Small> : null}

              {data.inbound.length > 0 ? (
                <>
                  <SectionHeader title="On order" />
                  <ListCard>
                    {data.inbound.map((line) => (
                      <ListRow
                        key={line.purchaseOrderId}
                        title={line.number}
                        subtitle={`${formatDue(line.expectedOn)} · ${line.status === 'partial' ? 'partly received' : 'sent'}`}
                        onPress={() => router.push(`/po/${line.purchaseOrderId}`)}
                        right={<Qty value={formatCount(line.remaining)} unit={data.unit} />}
                      />
                    ))}
                  </ListCard>
                </>
              ) : null}

              {data.description ? (
                <>
                  <SectionHeader title="Notes" />
                  <Body>{data.description}</Body>
                </>
              ) : null}

              <SectionHeader title="History" />
              {data.movements.length === 0 ? (
                <Notice tone="neutral">No movements yet.</Notice>
              ) : (
                <ListCard>
                  {data.movements.map((movement) => (
                    <MovementRow key={movement.id} movement={movement} showProduct={false} />
                  ))}
                </ListCard>
              )}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Small>{label}</Small>
      <Text style={{ color: colors.ink, fontFamily: fontFamily?.semibold, fontSize: 15 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  big: { fontSize: 44, lineHeight: 52, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 18 },
  facts: { flexDirection: 'row', gap: 12 },
});
