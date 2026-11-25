import { router } from 'expo-router';
import { View } from 'react-native';

import { formatCount, formatMoneyShort, plural } from '@/domain/format';
import { Card, Eyebrow, Label, ListCard, ListRow, QueryState, Qty, Screen, Small, Title } from '@/ui/components';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function LocationsScreen() {
  const { actor, repo, revision } = useWorkspace();
  const warehouses = useAsync(() => repo.listWarehouses(), [actor?.activeTenantId, revision]);

  return (
    <Screen testID="locations">
      <Eyebrow>Stock by location</Eyebrow>
      <Title>Locations</Title>
      <QueryState
        query={warehouses}
        loading="Walking the aisles"
        isEmpty={(data) => data.length === 0}
        empty={{ title: 'No warehouses yet', body: 'Add a warehouse and its locations in the Shelfly web app.', icon: 'business-outline' }}
      >
        {(data) =>
          data.map((warehouse) => (
            <View key={warehouse.id} style={{ gap: 10 }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Label>{warehouse.name}</Label>
                    <Small>
                      {warehouse.code} · {warehouse.city} · {plural(warehouse.locations.length, 'location')}
                    </Small>
                  </View>
                  <Qty value={formatMoneyShort(warehouse.valueCents)} unit={`${formatCount(warehouse.units)} units`} />
                </View>
              </Card>
              <ListCard>
                {warehouse.locations.map((location) => (
                  <ListRow
                    key={location.id}
                    title={location.name}
                    subtitle={`${location.code} · ${plural(location.skuCount, 'SKU')} · ${formatMoneyShort(location.valueCents)}`}
                    label={`${location.name}, ${warehouse.name}`}
                    onPress={() => router.push(`/location/${location.id}`)}
                    right={<Qty value={formatCount(location.units)} unit="units" />}
                  />
                ))}
              </ListCard>
            </View>
          ))
        }
      </QueryState>
    </Screen>
  );
}
