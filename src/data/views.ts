/**
 * Pure projections from a TenantSnapshot into the shapes the screens render.
 * Mock mode and Supabase load a snapshot differently but share every line below,
 * so the two modes cannot drift apart on what "low", "remaining" or "value" mean.
 */
import { findByCode, itemIdFromLink } from '@/domain/barcode';
import { ShelflyError } from '@/domain/errors';
import type { Alert, Movement, Product, TenantSnapshot } from '@/domain/model';
import { isLowStock, remainingToReceive } from '@/domain/stock';
import type {
  AlertView,
  Dashboard,
  ItemDetail,
  ItemSummary,
  LocationDetail,
  LocationOption,
  LookupResult,
  MovementView,
  PoDetail,
  PoSummary,
  WarehouseStock,
} from '@/domain/types';

function onHandOf(snap: TenantSnapshot, productId: string): number {
  return snap.stock.filter((row) => row.productId === productId).reduce((sum, row) => sum + row.qty, 0);
}

export function itemSummary(snap: TenantSnapshot, product: Product): ItemSummary {
  const rows = snap.stock.filter((row) => row.productId === product.id);
  const onHand = rows.reduce((sum, row) => sum + row.qty, 0);
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    unit: product.unit,
    barcode: product.barcode,
    onHand,
    reorderPoint: product.reorderPoint,
    low: isLowStock(onHand, product.reorderPoint),
    costCents: product.costCents,
    valueCents: Math.max(onHand, 0) * product.costCents,
    locationCount: rows.filter((row) => row.qty !== 0).length,
  };
}

export function listItems(snap: TenantSnapshot): ItemSummary[] {
  return snap.products
    .map((product) => itemSummary(snap, product))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function locationLabel(snap: TenantSnapshot, id: string | null): string | null {
  if (!id) return null;
  const location = snap.locations.find((item) => item.id === id);
  if (!location) return null;
  const warehouse = snap.warehouses.find((item) => item.id === location.warehouseId);
  return warehouse ? `${warehouse.code} · ${location.name}` : location.name;
}

export function movementView(snap: TenantSnapshot, movement: Movement): MovementView {
  const product = snap.products.find((item) => item.id === movement.productId);
  const person = snap.people.find((item) => item.id === movement.createdBy);
  return {
    id: movement.id,
    type: movement.type,
    productId: movement.productId,
    productName: product?.name ?? 'Removed SKU',
    sku: product?.sku ?? '—',
    unit: product?.unit ?? 'each',
    qty: movement.qty,
    signedQty: movement.signedQty,
    fromLabel: locationLabel(snap, movement.fromLocationId),
    toLabel: locationLabel(snap, movement.toLocationId),
    reason: movement.reason,
    reference: snap.purchaseOrders.find((po) => po.id === movement.reference)?.number ?? movement.reference,
    createdByName: person?.name ?? 'Shelfly',
    createdAt: movement.createdAt,
  };
}

export function listMovements(snap: TenantSnapshot, limit = 60): MovementView[] {
  return [...snap.movements]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, limit)
    .map((movement) => movementView(snap, movement));
}

export function locationOptions(snap: TenantSnapshot, warehouseId?: string): LocationOption[] {
  return snap.locations
    .filter((location) => !warehouseId || location.warehouseId === warehouseId)
    .map((location) => {
      const warehouse = snap.warehouses.find((item) => item.id === location.warehouseId);
      return {
        id: location.id,
        name: location.name,
        code: location.code,
        warehouseId: location.warehouseId,
        warehouseName: warehouse?.name ?? '',
        warehouseCode: warehouse?.code ?? '',
      };
    })
    .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
}

export function itemDetail(snap: TenantSnapshot, productId: string): ItemDetail {
  const product = snap.products.find((item) => item.id === productId);
  if (!product) throw new ShelflyError('not_found', 'That SKU is not in this workspace.');
  const summary = itemSummary(snap, product);
  const byLocation = locationOptions(snap)
    .map((location) => ({
      locationId: location.id,
      locationName: location.name,
      locationCode: location.code,
      warehouseId: location.warehouseId,
      warehouseName: location.warehouseName,
      qty: snap.stock.find((row) => row.productId === productId && row.locationId === location.id)?.qty ?? 0,
    }))
    .sort((a, b) => b.qty - a.qty);
  const inbound = snap.poLines
    .filter((line) => line.productId === productId)
    .map((line) => {
      const po = snap.purchaseOrders.find((item) => item.id === line.purchaseOrderId);
      return po && (po.status === 'sent' || po.status === 'partial')
        ? {
            purchaseOrderId: po.id,
            number: po.number,
            status: po.status,
            remaining: remainingToReceive(line.qtyOrdered, line.qtyReceived),
            expectedOn: po.expectedOn,
          }
        : null;
    })
    .filter((line): line is NonNullable<typeof line> => line !== null && line.remaining > 0);
  return {
    ...summary,
    description: product.description,
    byLocation,
    movements: listMovements({ ...snap, movements: snap.movements.filter((m) => m.productId === productId) }, 25),
    inbound,
    openAlertId: snap.alerts.find((alert) => alert.productId === productId && !alert.readAt)?.id ?? null,
  };
}

export function lookupCode(snap: TenantSnapshot, raw: string): LookupResult {
  const code = raw.trim();
  if (!code) return { kind: 'none', code, message: 'Scan or type a barcode or SKU.' };
  const linked = itemIdFromLink(code);
  if (linked) {
    const product = snap.products.find((item) => item.id === linked);
    if (product) return { kind: 'item', item: itemSummary(snap, product), matchedBy: 'link' };
  }
  const hit = findByCode(snap.products, code);
  if (hit) return { kind: 'item', item: itemSummary(snap, hit.item), matchedBy: hit.matchedBy };
  return {
    kind: 'none',
    code,
    message: `No SKU in ${snap.tenant.name} has the code ${code}.`,
  };
}

export function listWarehouses(snap: TenantSnapshot): WarehouseStock[] {
  return snap.warehouses
    .map((warehouse) => {
      const locations = snap.locations
        .filter((location) => location.warehouseId === warehouse.id)
        .map((location) => {
          const rows = snap.stock.filter((row) => row.locationId === location.id && row.qty !== 0);
          const valueCents = rows.reduce((sum, row) => {
            const product = snap.products.find((item) => item.id === row.productId);
            return sum + Math.max(row.qty, 0) * (product?.costCents ?? 0);
          }, 0);
          return {
            id: location.id,
            name: location.name,
            code: location.code,
            skuCount: rows.length,
            units: rows.reduce((sum, row) => sum + row.qty, 0),
            valueCents,
          };
        });
      return {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        city: warehouse.city,
        units: locations.reduce((sum, location) => sum + location.units, 0),
        valueCents: locations.reduce((sum, location) => sum + location.valueCents, 0),
        locations,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function locationDetail(snap: TenantSnapshot, locationId: string): LocationDetail {
  const location = snap.locations.find((item) => item.id === locationId);
  if (!location) throw new ShelflyError('not_found', 'That location is not in this workspace.');
  const warehouse = listWarehouses(snap).find((item) => item.id === location.warehouseId);
  const summary = warehouse?.locations.find((item) => item.id === locationId);
  const items = snap.stock
    .filter((row) => row.locationId === locationId && row.qty !== 0)
    .map((row) => {
      const product = snap.products.find((item) => item.id === row.productId);
      return product
        ? {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            unit: product.unit,
            qty: row.qty,
            low: isLowStock(onHandOf(snap, product.id), product.reorderPoint),
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: location.id,
    name: location.name,
    code: location.code,
    skuCount: summary?.skuCount ?? items.length,
    units: summary?.units ?? 0,
    valueCents: summary?.valueCents ?? 0,
    warehouseId: location.warehouseId,
    warehouseName: warehouse?.name ?? '',
    items,
  };
}

const STATUS_ORDER = { partial: 0, sent: 1, draft: 2, received: 3 } as const;

export function poSummary(snap: TenantSnapshot, poId: string): PoSummary {
  const po = snap.purchaseOrders.find((item) => item.id === poId);
  if (!po) throw new ShelflyError('not_found', 'Purchase order not found.');
  const lines = snap.poLines.filter((line) => line.purchaseOrderId === po.id);
  return {
    id: po.id,
    number: po.number,
    status: po.status,
    supplierName: snap.suppliers.find((item) => item.id === po.supplierId)?.name ?? 'Supplier',
    warehouseId: po.warehouseId,
    warehouseName: snap.warehouses.find((item) => item.id === po.warehouseId)?.name ?? '',
    expectedOn: po.expectedOn,
    lineCount: lines.length,
    ordered: lines.reduce((sum, line) => sum + line.qtyOrdered, 0),
    received: lines.reduce((sum, line) => sum + line.qtyReceived, 0),
    totalCents: lines.reduce((sum, line) => sum + line.qtyOrdered * line.unitCostCents, 0),
    updatedAt: po.updatedAt,
  };
}

export function listPurchaseOrders(snap: TenantSnapshot): PoSummary[] {
  return snap.purchaseOrders
    .map((po) => poSummary(snap, po.id))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.expectedOn ?? '9999').localeCompare(b.expectedOn ?? '9999') ||
        a.number.localeCompare(b.number),
    );
}

export function poDetail(snap: TenantSnapshot, poId: string): PoDetail {
  const summary = poSummary(snap, poId);
  const po = snap.purchaseOrders.find((item) => item.id === poId)!;
  const supplier = snap.suppliers.find((item) => item.id === po.supplierId);
  return {
    ...summary,
    notes: po.notes,
    supplierEmail: supplier?.email ?? '',
    supplierPhone: supplier?.phone ?? '',
    lines: snap.poLines
      .filter((line) => line.purchaseOrderId === po.id)
      .map((line) => {
        const product = snap.products.find((item) => item.id === line.productId);
        return {
          id: line.id,
          productId: line.productId,
          sku: product?.sku ?? '—',
          name: product?.name ?? 'Removed SKU',
          barcode: product?.barcode ?? '',
          unit: product?.unit ?? 'each',
          qtyOrdered: line.qtyOrdered,
          qtyReceived: line.qtyReceived,
          remaining: remainingToReceive(line.qtyOrdered, line.qtyReceived),
          unitCostCents: line.unitCostCents,
        };
      }),
    receivingLocations: locationOptions(snap, po.warehouseId),
  };
}

export function alertView(snap: TenantSnapshot, alert: Alert): AlertView {
  const product = snap.products.find((item) => item.id === alert.productId);
  return {
    id: alert.id,
    productId: alert.productId,
    sku: product?.sku ?? '—',
    productName: product?.name ?? 'Removed SKU',
    unit: product?.unit ?? 'each',
    onHand: onHandOf(snap, alert.productId),
    reorderPoint: product?.reorderPoint ?? 0,
    message: alert.message,
    createdAt: alert.createdAt,
    read: Boolean(alert.readAt),
  };
}

export function listAlerts(snap: TenantSnapshot): AlertView[] {
  return [...snap.alerts]
    .sort((a, b) => Number(Boolean(a.readAt)) - Number(Boolean(b.readAt)) || b.createdAt.localeCompare(a.createdAt))
    .map((alert) => alertView(snap, alert));
}

export function dashboard(snap: TenantSnapshot): Dashboard {
  const items = listItems(snap);
  const orders = listPurchaseOrders(snap);
  const open = orders.filter((po) => po.status === 'sent' || po.status === 'partial');
  const lowItems = items
    .filter((item) => item.low)
    .sort((a, b) => a.onHand - a.reorderPoint - (b.onHand - b.reorderPoint));
  return {
    workspace: {
      id: snap.tenant.id,
      name: snap.tenant.name,
      slug: snap.tenant.slug,
      industry: snap.tenant.industry,
      plan: snap.tenant.plan,
    },
    skuCount: items.length,
    units: items.reduce((sum, item) => sum + item.onHand, 0),
    valueCents: items.reduce((sum, item) => sum + item.valueCents, 0),
    lowCount: lowItems.length,
    unreadAlerts: snap.alerts.filter((alert) => !alert.readAt).length,
    openPoCount: open.length,
    inboundUnits: open.reduce((sum, po) => sum + (po.ordered - po.received), 0),
    lowItems: lowItems.slice(0, 5),
    openOrders: open.slice(0, 4),
    recent: listMovements(snap, 6),
    warehouses: listWarehouses(snap).map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      units: warehouse.units,
      valueCents: warehouse.valueCents,
    })),
  };
}
