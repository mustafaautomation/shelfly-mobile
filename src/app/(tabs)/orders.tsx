import { useState } from 'react';

import { canWrite } from '@/domain/access';
import { Body, EmptyBlock, Eyebrow, QueryState, Screen, Segmented, Title } from '@/ui/components';
import { PoCard } from '@/ui/rows';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

type Filter = 'open' | 'draft' | 'received';

const EMPTY: Record<Filter, { title: string; body: string }> = {
  open: { title: 'Nothing inbound', body: 'Sent and partly received orders show up here, ready to receive.' },
  draft: { title: 'No drafts', body: 'Drafts are created in the Shelfly web app. Send them from here once they are ready.' },
  received: { title: 'Nothing received yet', body: 'Orders move here once every line is on the shelf.' },
};

export default function OrdersScreen() {
  const { actor, repo, revision } = useWorkspace();
  const orders = useAsync(() => repo.listPurchaseOrders(), [actor?.activeTenantId, revision]);
  const [filter, setFilter] = useState<Filter>('open');

  return (
    <Screen testID="orders">
      <Eyebrow>Purchasing</Eyebrow>
      <Title>Purchase orders</Title>
      <Body>
        {canWrite(actor?.role)
          ? 'Open an order to receive it, in full or as a partial delivery.'
          : 'Every order and how much of it has arrived.'}
      </Body>
      <Segmented
        label="Order status"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'draft', label: 'Drafts' },
          { value: 'received', label: 'Received' },
        ]}
      />
      <QueryState query={orders} loading="Loading purchase orders">
        {(data) => {
          const shown = data.filter((po) =>
            filter === 'open' ? po.status === 'sent' || po.status === 'partial' : po.status === filter,
          );
          if (shown.length === 0) return <EmptyBlock icon="clipboard-outline" title={EMPTY[filter].title} body={EMPTY[filter].body} />;
          return shown.map((po) => <PoCard key={po.id} po={po} />);
        }}
      </QueryState>
    </Screen>
  );
}
