import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { poStatusLabel } from '@/domain/access';
import { formatCount, formatDue, formatMoney, formatRelative, formatSigned, plural } from '@/domain/format';
import type { AlertView, ItemSummary, MovementView, PoSummary } from '@/domain/types';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import type { Tone } from '@/theme/tokens';
import { Card, Label, ListRow, Pill, ProgressBar, Qty, Small, StockBar } from '@/ui/components';

export function ItemRow({ item }: { item: ItemSummary }) {
  return (
    <ListRow
      title={item.name}
      subtitle={`${item.sku} · ${item.category}`}
      label={`${item.name}, ${formatCount(item.onHand)} ${item.unit} on hand${item.low ? ', low stock' : ''}`}
      onPress={() => router.push(`/item/${item.id}` as never)}
      testID={`item-${item.id}`}
      right={<Qty value={formatCount(item.onHand)} unit={item.unit} tone={item.low ? 'danger' : undefined} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <StockBar onHand={item.onHand} reorderPoint={item.reorderPoint} />
        </View>
        {item.low ? <Pill label="Low" tone="danger" /> : <Small>min {formatCount(item.reorderPoint)}</Small>}
      </View>
    </ListRow>
  );
}

const MOVE_ICON = { receive: 'arrow-down-circle', adjust: 'swap-vertical', transfer: 'git-compare' } as const;

export function MovementRow({ movement, showProduct = true }: { movement: MovementView; showProduct?: boolean }) {
  const { colors } = useShelflyTheme();
  const where =
    movement.type === 'transfer'
      ? `${movement.fromLabel ?? '?'} → ${movement.toLabel ?? '?'}`
      : (movement.toLabel ?? movement.fromLabel ?? '');
  const tone = movement.type === 'transfer' ? undefined : movement.signedQty > 0 ? 'good' : 'danger';
  const verb = movement.type === 'receive' ? 'Received' : movement.type === 'transfer' ? 'Moved' : 'Adjusted';
  return (
    <ListRow
      title={showProduct ? movement.productName : `${verb} · ${where}`}
      subtitle={`${showProduct ? `${verb} · ${where} · ` : ''}${movement.reason}`}
      label={`${verb} ${movement.qty} ${movement.unit} of ${movement.productName}, ${movement.reason}`}
      onPress={showProduct ? () => router.push(`/item/${movement.productId}` as never) : undefined}
      leading={
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={MOVE_ICON[movement.type]} size={18} color={colors.ink} />
        </View>
      }
      right={<Qty value={movement.type === 'transfer' ? formatCount(movement.qty) : formatSigned(movement.signedQty)} unit={movement.unit} tone={tone} />}
    >
      <Small>
        {movement.createdByName} · {formatRelative(movement.createdAt)}
        {movement.reference ? ` · ${movement.reference}` : ''}
      </Small>
    </ListRow>
  );
}

export function poTone(status: PoSummary['status']): Tone {
  if (status === 'partial') return 'warn';
  if (status === 'sent') return 'primary';
  if (status === 'received') return 'good';
  return 'neutral';
}

export function PoCard({ po }: { po: PoSummary }) {
  const late = po.expectedOn && (po.status === 'sent' || po.status === 'partial') && formatDue(po.expectedOn).includes('late');
  return (
    <Card onPress={() => router.push(`/po/${po.id}` as never)} label={`${po.number}, ${po.supplierName}, ${poStatusLabel(po.status)}`} testID={`po-${po.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Label style={{ flex: 1 }}>{po.number}</Label>
        <Pill label={poStatusLabel(po.status)} tone={poTone(po.status)} />
      </View>
      <Small>
        {po.supplierName} → {po.warehouseName}
      </Small>
      <ProgressBar value={po.ordered ? po.received / po.ordered : 0} tone={po.status === 'received' ? 'good' : 'forest'} label={`${po.number} received`} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Small>
          {formatCount(po.received)} of {formatCount(po.ordered)} in · {plural(po.lineCount, 'line')} · {formatMoney(po.totalCents)}
        </Small>
        {po.status !== 'received' ? <Small style={late ? { fontWeight: '700' } : undefined}>{formatDue(po.expectedOn)}</Small> : null}
      </View>
    </Card>
  );
}

export function AlertRow({ alert, onOpen, onMarkRead }: { alert: AlertView; onOpen: () => void; onMarkRead?: () => void }) {
  const { colors } = useShelflyTheme();
  return (
    <ListRow
      title={alert.productName}
      subtitle={`${alert.sku} · ${formatCount(alert.onHand)} ${alert.unit} on hand, reorder at ${formatCount(alert.reorderPoint)}`}
      label={`${alert.productName}, ${alert.read ? 'read' : 'unread'} low-stock alert`}
      onPress={onOpen}
      leading={
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: alert.read ? colors.line : colors.danger }} />
      }
      right={
        onMarkRead && !alert.read ? (
          <Pill label="Unread" tone="danger" />
        ) : alert.read ? (
          <Pill label="Read" />
        ) : null
      }
    >
      <Small>{formatRelative(alert.createdAt)}</Small>
    </ListRow>
  );
}
