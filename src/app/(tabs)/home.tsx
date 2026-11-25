import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { canManage, canWrite, isFloorRole, planLabel, roleLabel } from '@/domain/access';
import { formatCount, formatMoneyShort, plural } from '@/domain/format';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import { brand } from '@/theme/tokens';
import { ShelflyMark } from '@/ui/ShelflyMark';
import {
  Button,
  IconButton,
  ListCard,
  ListRow,
  Notice,
  QueryState,
  Qty,
  Screen,
  SectionHeader,
  StatTile,
} from '@/ui/components';
import { ItemRow, MovementRow, PoCard } from '@/ui/rows';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { actor, repo, revision, mode } = useWorkspace();
  const { fontFamily } = useShelflyTheme();
  const board = useAsync(() => repo.getDashboard(), [actor?.activeTenantId, revision]);
  const firstName = actor?.name.split(' ')[0] ?? '';
  const floor = isFloorRole(actor?.role);

  return (
    <Screen testID="home">
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { fontFamily: fontFamily?.display }]} accessibilityRole="header">
            {greeting()}, {firstName}
          </Text>
        </View>
        <IconButton icon="scan-outline" label="Scan a barcode" onPress={() => router.push('/scan')} />
        <IconButton
          icon="notifications-outline"
          label="Alerts"
          badge={board.data?.unreadAlerts || undefined}
          onPress={() => router.push('/alerts')}
        />
      </View>
      <QueryState query={board} loading="Counting the shelves">
        {(data) => (
          <>
            <View style={styles.mast}>
              <ShelflyMark size={42} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.mastName, { fontFamily: fontFamily?.display }]} numberOfLines={2}>
                  {data.workspace.name}
                </Text>
                <Text style={[styles.mastMeta, { fontFamily: fontFamily?.body }]}>
                  {roleLabel(actor?.role)} · {planLabel(data.workspace.plan)} · {mode === 'mock' ? 'Demo books' : 'Live'}
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              <StatTile icon="cash-outline" label="Stock value" value={formatMoneyShort(data.valueCents)} hint={`${formatCount(data.units)} units`} tone="forest" />
              <StatTile icon="cube-outline" label="SKUs" value={formatCount(data.skuCount)} hint={plural(data.warehouses.length, 'warehouse')} onPress={() => router.push('/items')} />
              <StatTile
                icon="warning-outline"
                label="Low stock"
                value={formatCount(data.lowCount)}
                hint="at or below reorder"
                tone={data.lowCount > 0 ? 'danger' : 'good'}
                onPress={() => router.push('/items?filter=low')}
              />
              <StatTile
                icon="boat-outline"
                label="Inbound"
                value={formatCount(data.inboundUnits)}
                hint={plural(data.openPoCount, 'open order')}
                tone="primary"
                onPress={() => router.push('/orders')}
              />
            </View>

            {canWrite(actor?.role) ? (
              <View style={styles.actions}>
                {floor ? (
                  <>
                    <View style={{ flex: 1 }}>
                      <Button label="Scan" icon="scan" onPress={() => router.push('/scan')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label="Receive" icon="download-outline" variant="forest" onPress={() => router.push('/orders')} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={{ flex: 1 }}>
                      <Button label="By location" icon="grid-outline" variant="forest" onPress={() => router.push('/locations')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label="Scan" icon="scan" variant="secondary" onPress={() => router.push('/scan')} />
                    </View>
                  </>
                )}
              </View>
            ) : (
              <Notice tone="neutral" icon="eye-outline">
                You have a viewer seat. Every number is live, and stock changes are left to the floor team.
              </Notice>
            )}

            <SectionHeader title="Needs restock" action={data.lowCount > 0 ? { label: 'See all', onPress: () => router.push('/items?filter=low') } : undefined} />
            {data.lowItems.length === 0 ? (
              <Notice tone="good">Every SKU is above its reorder point.</Notice>
            ) : (
              <ListCard>
                {data.lowItems.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ListCard>
            )}

            <SectionHeader title="Inbound" action={{ label: 'All orders', onPress: () => router.push('/orders') }} />
            {data.openOrders.length === 0 ? (
              <Notice tone="neutral">No purchase orders are on the way.</Notice>
            ) : (
              data.openOrders.map((po) => <PoCard key={po.id} po={po} />)
            )}

            {canManage(actor?.role) || actor?.role === 'viewer' ? (
              <>
                <SectionHeader title="By warehouse" action={{ label: 'Locations', onPress: () => router.push('/locations') }} />
                <ListCard>
                  {data.warehouses.map((warehouse) => (
                    <ListRow
                      key={warehouse.id}
                      title={warehouse.name}
                      subtitle={`${formatMoneyShort(warehouse.valueCents)} on the shelves`}
                      onPress={() => router.push('/locations')}
                      right={<Qty value={formatCount(warehouse.units)} unit="units" />}
                    />
                  ))}
                </ListCard>
              </>
            ) : null}

            <SectionHeader title="Recent movements" action={{ label: 'Full ledger', onPress: () => router.push('/activity') }} />
            <ListCard>
              {data.recent.map((movement) => (
                <MovementRow key={movement.id} movement={movement} />
              ))}
            </ListCard>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { fontSize: 28, lineHeight: 34 },
  mast: { backgroundColor: brand.forest, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  mastName: { color: brand.paper, fontSize: 22, lineHeight: 27 },
  mastMeta: { color: 'rgba(243,239,228,0.8)', fontSize: 14, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
});
