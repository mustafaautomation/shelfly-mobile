import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { formatCount, plural } from '@/domain/format';
import { matchesSearch } from '@/domain/search';
import { Chip, ChipRow, EmptyBlock, IconButton, ListCard, QueryState, Screen, Small, TextField, Title } from '@/ui/components';
import { ItemRow } from '@/ui/rows';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function ItemsScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { actor, repo, revision } = useWorkspace();
  const items = useAsync(() => repo.listItems(), [actor?.activeTenantId, revision]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>(params.filter === 'low' ? 'low' : 'all');

  // Follow a new ?filter= link (the Low stock tile on Home) even when this tab is already mounted.
  const [linkedFilter, setLinkedFilter] = useState(params.filter);
  if (params.filter !== linkedFilter) {
    setLinkedFilter(params.filter);
    if (params.filter === 'low') setFilter('low');
  }

  const categories = useMemo(() => [...new Set((items.data ?? []).map((item) => item.category))], [items.data]);

  return (
    <Screen testID="items">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Title style={{ flex: 1 }}>Items</Title>
        <IconButton icon="scan-outline" label="Scan a barcode" onPress={() => router.push('/scan')} />
      </View>
      <TextField
        label="Search items"
        hideLabel
        icon="search"
        value={query}
        onChangeText={setQuery}
        placeholder="SKU, name, barcode or category"
        testID="item-search"
      />
      <ChipRow>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Low stock" selected={filter === 'low'} onPress={() => setFilter('low')} />
        {categories.map((category) => (
          <Chip key={category} label={category} selected={filter === category} onPress={() => setFilter(category)} />
        ))}
      </ChipRow>
      <QueryState query={items} loading="Loading the catalog">
        {(data) => {
          const shown = data.filter(
            (item) => matchesSearch(item, query) && (filter === 'all' || (filter === 'low' ? item.low : item.category === filter)),
          );
          if (shown.length === 0) {
            return (
              <EmptyBlock
                icon="search-outline"
                title={filter === 'low' && !query ? 'Nothing is low' : 'No matches'}
                body={
                  filter === 'low' && !query
                    ? 'Every SKU in this workspace is above its reorder point.'
                    : `Nothing in this workspace matches “${query}”. Try a SKU like ${data[0]?.sku ?? 'NW-RT-ETH'} or scan the label.`
                }
              />
            );
          }
          const units = shown.reduce((sum, item) => sum + item.onHand, 0);
          return (
            <>
              <Small>
                {plural(shown.length, 'SKU')} · {formatCount(units)} units on hand
              </Small>
              <ListCard>
                {shown.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ListCard>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}
