import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { formatCount, formatMoneyShort, plural } from '@/domain/format';
import { EmptyBlock, ListCard, ListRow, Pill, QueryState, Qty, Screen, StackHeader, StatTile } from '@/ui/components';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function LocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actor, repo, revision } = useWorkspace();
  const location = useAsync(() => repo.getLocation(String(id)), [id, actor?.activeTenantId, revision]);

  return (
    <Screen testID="location">
      <StackHeader
        title={location.data?.name ?? 'Location'}
        subtitle={location.data ? `${location.data.warehouseName} · ${location.data.code}` : undefined}
        fallback="/locations"
      />
      <QueryState query={location} loading="Reading the bin">
        {(data) => (
          <>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <StatTile icon="cube-outline" label="Units" value={formatCount(data.units)} hint={plural(data.skuCount, 'SKU')} tone="forest" />
              <StatTile icon="cash-outline" label="Value" value={formatMoneyShort(data.valueCents)} hint="at unit cost" tone="primary" />
            </View>
            {data.items.length === 0 ? (
              <EmptyBlock icon="file-tray-outline" title="Empty shelf" body="Nothing is stocked here right now. Receive or transfer stock into this location from an item." />
            ) : (
              <ListCard>
                {data.items.map((item) => (
                  <ListRow
                    key={item.productId}
                    title={item.name}
                    subtitle={item.sku}
                    label={`${item.name}, ${item.qty} ${item.unit} here`}
                    onPress={() => router.push(`/item/${item.productId}`)}
                    right={
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Qty value={formatCount(item.qty)} unit={item.unit} tone={item.qty < 0 ? 'danger' : undefined} />
                        {item.low ? <Pill label="Low" tone="danger" /> : null}
                      </View>
                    }
                  />
                ))}
              </ListCard>
            )}
          </>
        )}
      </QueryState>
    </Screen>
  );
}
