import { useState } from 'react';

import type { MovementType } from '@/domain/model';
import { EmptyBlock, ListCard, QueryState, Screen, Segmented, StackHeader } from '@/ui/components';
import { MovementRow } from '@/ui/rows';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

type Filter = 'all' | MovementType;

export default function ActivityScreen() {
  const { actor, repo, revision } = useWorkspace();
  const ledger = useAsync(() => repo.listMovements(120), [actor?.activeTenantId, revision]);
  const [filter, setFilter] = useState<Filter>('all');

  return (
    <Screen testID="activity">
      <StackHeader title="Movement ledger" subtitle="Append-only. Nothing here can be edited or deleted." fallback="/more" />
      <Segmented<Filter>
        label="Movement type"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'receive', label: 'Receipts' },
          { value: 'adjust', label: 'Adjusts' },
          { value: 'transfer', label: 'Transfers' },
        ]}
      />
      <QueryState query={ledger} loading="Reading the ledger">
        {(data) => {
          const shown = data.filter((movement) => filter === 'all' || movement.type === filter);
          if (shown.length === 0) return <EmptyBlock icon="reader-outline" title="Nothing here yet" body="Movements of this type will be listed as they are posted." />;
          return (
            <ListCard>
              {shown.map((movement) => (
                <MovementRow key={movement.id} movement={movement} />
              ))}
            </ListCard>
          );
        }}
      </QueryState>
    </Screen>
  );
}
