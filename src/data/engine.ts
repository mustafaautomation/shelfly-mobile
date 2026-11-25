/**
 * The mock-mode inventory engine. It applies the same rules as the web app's lib/engine.ts
 * and the Supabase functions `apply_movement` and `receive_purchase_order`:
 * tenant checks first, then role checks, then stock math, one immutable movement per change,
 * and a low-stock alert when a SKU reaches its reorder point.
 */
import { ShelflyError } from '@/domain/errors';
import type {
  Alert,
  Location,
  Membership,
  Movement,
  Person,
  PoLine,
  Product,
  PurchaseOrder,
  SeatRole,
  StockLevel,
  Supplier,
  Tenant,
  TenantSnapshot,
  Unit,
  Warehouse,
} from '@/domain/model';
import { canWrite } from '@/domain/access';
import {
  applyAdjust,
  applyReceive,
  applyTransfer,
  isLowStock,
  poStatusAfterReceipt,
  remainingToReceive,
} from '@/domain/stock';

export interface MockUser extends Person {
  password: string;
}

export interface MockDatabase {
  version: number;
  tenants: Tenant[];
  users: MockUser[];
  memberships: Membership[];
  warehouses: Warehouse[];
  locations: Location[];
  products: Product[];
  stock: StockLevel[];
  movements: Movement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poLines: PoLine[];
  alerts: Alert[];
  magicLinks: { token: string; userId: string; expiresAt: string }[];
  pushTokens: { userId: string; token: string; platform: string }[];
  seq: number;
}

export const MOCK_DB_VERSION = 1;

export interface EngineActor {
  userId: string;
  role: SeatRole | null;
}

export function emptyDatabase(): MockDatabase {
  return {
    version: MOCK_DB_VERSION,
    tenants: [],
    users: [],
    memberships: [],
    warehouses: [],
    locations: [],
    products: [],
    stock: [],
    movements: [],
    suppliers: [],
    purchaseOrders: [],
    poLines: [],
    alerts: [],
    magicLinks: [],
    pushTokens: [],
    seq: 1000,
  };
}

export function nextId(db: MockDatabase, prefix: string): string {
  db.seq += 1;
  return `${prefix}_${db.seq.toString(36)}`;
}

export function seatFor(db: MockDatabase, userId: string, tenantId: string): SeatRole | null {
  const user = db.users.find((item) => item.id === userId);
  if (!user) return null;
  if (user.isSuperAdmin && db.tenants.some((tenant) => tenant.id === tenantId)) return 'super_admin';
  return db.memberships.find((item) => item.userId === userId && item.tenantId === tenantId)?.role ?? null;
}

export function assertCanRead(db: MockDatabase, actor: EngineActor, tenantId: string): void {
  if (!seatFor(db, actor.userId, tenantId)) {
    throw new ShelflyError('forbidden', 'You do not belong to this workspace.');
  }
}

export function assertCanWrite(db: MockDatabase, actor: EngineActor, tenantId: string): void {
  assertCanRead(db, actor, tenantId);
  const role = seatFor(db, actor.userId, tenantId);
  if (role === 'viewer') throw new ShelflyError('forbidden', 'Viewers cannot change inventory.');
  if (!canWrite(role)) throw new ShelflyError('forbidden', 'You cannot change inventory in this workspace.');
}

function productOf(db: MockDatabase, tenantId: string, productId: string): Product {
  const product = db.products.find((item) => item.id === productId && item.tenantId === tenantId);
  if (!product) throw new ShelflyError('not_found', 'That SKU is not in this workspace.');
  return product;
}

function locationOf(db: MockDatabase, tenantId: string, locationId: string): Location {
  const location = db.locations.find((item) => item.id === locationId && item.tenantId === tenantId);
  if (!location) throw new ShelflyError('invalid', 'That location is not in this workspace.');
  return location;
}

function purchaseOrderOf(db: MockDatabase, tenantId: string, id: string): PurchaseOrder {
  const po = db.purchaseOrders.find((item) => item.id === id && item.tenantId === tenantId);
  if (!po) throw new ShelflyError('not_found', 'Purchase order not found.');
  return po;
}

function stockRow(db: MockDatabase, tenantId: string, productId: string, locationId: string): StockLevel {
  const existing = db.stock.find((row) => row.productId === productId && row.locationId === locationId);
  if (existing) {
    if (existing.tenantId !== tenantId) throw new ShelflyError('forbidden', 'Stock row is outside this workspace.');
    return existing;
  }
  const created: StockLevel = { id: `stk_${productId}_${locationId}`, tenantId, productId, locationId, qty: 0 };
  db.stock.push(created);
  return created;
}

export function totalOnHand(db: MockDatabase, productId: string): number {
  return db.stock.filter((row) => row.productId === productId).reduce((sum, row) => sum + row.qty, 0);
}

/** Opens one unread low-stock alert per SKU, like private.sync_low_stock. Returns the new alert, if any. */
export function syncLowStock(db: MockDatabase, tenantId: string, productId: string, at: string): Alert | null {
  const product = db.products.find((item) => item.id === productId && item.tenantId === tenantId);
  if (!product) return null;
  const onHand = totalOnHand(db, productId);
  const open = db.alerts.find((alert) => alert.productId === productId && alert.tenantId === tenantId && !alert.readAt);
  if (!isLowStock(onHand, product.reorderPoint) || open) return null;
  const alert: Alert = {
    id: nextId(db, 'alt'),
    tenantId,
    productId,
    kind: 'low_stock',
    message: `${product.name} (${product.sku}) is at ${onHand} ${product.unit}, at or below the reorder point of ${product.reorderPoint}.`,
    createdAt: at,
    readAt: null,
  };
  db.alerts.push(alert);
  return alert;
}

export interface MovementOutcome {
  movement: Movement;
  alert: Alert | null;
}

function record(db: MockDatabase, input: Omit<Movement, 'id' | 'qty'>): MovementOutcome {
  const movement: Movement = { id: nextId(db, 'mov'), qty: Math.abs(input.signedQty), ...input };
  db.movements.push(movement);
  return { movement, alert: syncLowStock(db, input.tenantId, input.productId, input.createdAt) };
}

export function postReceive(
  db: MockDatabase,
  actor: EngineActor,
  input: { tenantId: string; productId: string; locationId: string; qty: number; reason?: string; reference?: string | null; at: string },
): MovementOutcome {
  assertCanWrite(db, actor, input.tenantId);
  productOf(db, input.tenantId, input.productId);
  locationOf(db, input.tenantId, input.locationId);
  const row = stockRow(db, input.tenantId, input.productId, input.locationId);
  row.qty = applyReceive(row.qty, input.qty);
  return record(db, {
    tenantId: input.tenantId,
    type: 'receive',
    productId: input.productId,
    signedQty: input.qty,
    fromLocationId: null,
    toLocationId: input.locationId,
    reason: input.reason?.trim() || 'Receipt',
    reference: input.reference ?? null,
    createdBy: actor.userId,
    createdAt: input.at,
  });
}

export function postAdjust(
  db: MockDatabase,
  actor: EngineActor,
  input: { tenantId: string; productId: string; locationId: string; delta: number; reason?: string; at: string },
): MovementOutcome {
  assertCanWrite(db, actor, input.tenantId);
  productOf(db, input.tenantId, input.productId);
  locationOf(db, input.tenantId, input.locationId);
  const row = stockRow(db, input.tenantId, input.productId, input.locationId);
  row.qty = applyAdjust(row.qty, input.delta, input.reason);
  return record(db, {
    tenantId: input.tenantId,
    type: 'adjust',
    productId: input.productId,
    signedQty: input.delta,
    fromLocationId: input.delta < 0 ? input.locationId : null,
    toLocationId: input.delta > 0 ? input.locationId : null,
    reason: input.reason?.trim() || 'Adjustment',
    reference: null,
    createdBy: actor.userId,
    createdAt: input.at,
  });
}

export function postTransfer(
  db: MockDatabase,
  actor: EngineActor,
  input: {
    tenantId: string;
    productId: string;
    fromLocationId: string;
    toLocationId: string;
    qty: number;
    reason?: string;
    at: string;
  },
): MovementOutcome {
  assertCanWrite(db, actor, input.tenantId);
  if (input.fromLocationId === input.toLocationId) throw new ShelflyError('stock', 'Choose two different locations.');
  productOf(db, input.tenantId, input.productId);
  locationOf(db, input.tenantId, input.fromLocationId);
  locationOf(db, input.tenantId, input.toLocationId);
  const source = stockRow(db, input.tenantId, input.productId, input.fromLocationId);
  const dest = stockRow(db, input.tenantId, input.productId, input.toLocationId);
  const next = applyTransfer(source.qty, dest.qty, input.qty);
  source.qty = next.source;
  dest.qty = next.dest;
  return record(db, {
    tenantId: input.tenantId,
    type: 'transfer',
    productId: input.productId,
    signedQty: input.qty,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    reason: input.reason?.trim() || 'Transfer',
    reference: null,
    createdBy: actor.userId,
    createdAt: input.at,
  });
}

export function createProduct(
  db: MockDatabase,
  input: {
    id: string;
    tenantId: string;
    sku: string;
    name: string;
    category: string;
    unit: Unit;
    costCents: number;
    reorderPoint: number;
    barcode: string;
    description: string;
    at: string;
  },
): Product {
  const product: Product = {
    id: input.id,
    tenantId: input.tenantId,
    sku: input.sku,
    name: input.name,
    description: input.description,
    barcode: input.barcode,
    category: input.category,
    unit: input.unit,
    costCents: input.costCents,
    reorderPoint: input.reorderPoint,
    createdAt: input.at,
  };
  db.products.push(product);
  return product;
}

export function addPoLine(
  db: MockDatabase,
  input: { id?: string; tenantId: string; purchaseOrderId: string; productId: string; qtyOrdered: number; unitCostCents: number },
): PoLine {
  const po = purchaseOrderOf(db, input.tenantId, input.purchaseOrderId);
  productOf(db, input.tenantId, input.productId);
  const line: PoLine = {
    id: input.id ?? nextId(db, 'pol'),
    tenantId: input.tenantId,
    purchaseOrderId: po.id,
    productId: input.productId,
    qtyOrdered: input.qtyOrdered,
    qtyReceived: 0,
    unitCostCents: input.unitCostCents,
  };
  db.poLines.push(line);
  return line;
}

export function sendPurchaseOrder(
  db: MockDatabase,
  actor: EngineActor,
  input: { tenantId: string; purchaseOrderId: string; at: string },
): PurchaseOrder {
  assertCanWrite(db, actor, input.tenantId);
  const po = purchaseOrderOf(db, input.tenantId, input.purchaseOrderId);
  if (po.status !== 'draft') throw new ShelflyError('invalid', 'Only draft orders can be sent.');
  if (!db.poLines.some((line) => line.purchaseOrderId === po.id)) {
    throw new ShelflyError('invalid', 'Add at least one line before sending.');
  }
  po.status = 'sent';
  po.updatedAt = input.at;
  return po;
}

export function receivePurchaseOrder(
  db: MockDatabase,
  actor: EngineActor,
  input: { tenantId: string; purchaseOrderId: string; locationId: string; lines: { lineId: string; qty: number }[]; at: string },
): { po: PurchaseOrder; units: number; alerts: Alert[] } {
  assertCanWrite(db, actor, input.tenantId);
  const po = purchaseOrderOf(db, input.tenantId, input.purchaseOrderId);
  if (po.status === 'draft') throw new ShelflyError('invalid', 'Send the purchase order before receiving it.');
  if (po.status === 'received') throw new ShelflyError('invalid', 'This purchase order is already fully received.');
  const location = locationOf(db, input.tenantId, input.locationId);
  if (location.warehouseId !== po.warehouseId) {
    throw new ShelflyError('stock', 'Receive into a location that belongs to the purchase order warehouse.');
  }
  const requested = input.lines.filter((line) => line.qty !== 0);
  if (requested.length === 0) throw new ShelflyError('invalid', 'Enter a quantity to receive.');
  // Validate every line before touching stock, so a bad line cannot leave a half-posted receipt.
  for (const request of requested) {
    const line = db.poLines.find((item) => item.id === request.lineId && item.purchaseOrderId === po.id);
    if (!line) throw new ShelflyError('invalid', 'A receipt line does not belong to this order.');
    if (!Number.isInteger(request.qty) || request.qty < 0) {
      throw new ShelflyError('stock', 'Receipt quantity must be a whole number of zero or more.');
    }
    const remaining = remainingToReceive(line.qtyOrdered, line.qtyReceived);
    if (request.qty > remaining) {
      const product = productOf(db, input.tenantId, line.productId);
      throw new ShelflyError('stock', `Cannot receive ${request.qty} of ${product.sku}. Only ${remaining} remain on the order.`);
    }
  }
  let units = 0;
  const alerts: Alert[] = [];
  for (const request of requested) {
    const line = db.poLines.find((item) => item.id === request.lineId)!;
    const outcome = postReceive(db, actor, {
      tenantId: input.tenantId,
      productId: line.productId,
      locationId: location.id,
      qty: request.qty,
      reason: `Received on ${po.number}`,
      reference: po.id,
      at: input.at,
    });
    if (outcome.alert) alerts.push(outcome.alert);
    line.qtyReceived += request.qty;
    units += request.qty;
  }
  po.status = poStatusAfterReceipt(db.poLines.filter((line) => line.purchaseOrderId === po.id));
  po.updatedAt = input.at;
  return { po, units, alerts };
}

export function markAlertRead(
  db: MockDatabase,
  actor: EngineActor,
  input: { tenantId: string; alertId: string; at: string },
): Alert {
  assertCanRead(db, actor, input.tenantId);
  if (seatFor(db, actor.userId, input.tenantId) === 'viewer') {
    throw new ShelflyError('forbidden', 'Viewers cannot change alerts.');
  }
  const alert = db.alerts.find((item) => item.id === input.alertId && item.tenantId === input.tenantId);
  if (!alert) throw new ShelflyError('not_found', 'Alert not found.');
  alert.readAt = alert.readAt ?? input.at;
  return alert;
}

/** Copies one tenant's rows out of the shared mock database. Nothing from another tenant leaks through. */
export function snapshotFor(db: MockDatabase, tenantId: string): TenantSnapshot {
  const tenant = db.tenants.find((item) => item.id === tenantId);
  if (!tenant) throw new ShelflyError('not_found', 'Workspace not found.');
  const own = <T extends { tenantId: string }>(rows: T[]) => rows.filter((row) => row.tenantId === tenantId);
  const memberIds = new Set(own(db.memberships).map((item) => item.userId));
  return {
    tenant,
    warehouses: own(db.warehouses),
    locations: own(db.locations),
    products: own(db.products),
    stock: own(db.stock),
    movements: own(db.movements),
    suppliers: own(db.suppliers),
    purchaseOrders: own(db.purchaseOrders),
    poLines: own(db.poLines),
    alerts: own(db.alerts),
    people: db.users
      .filter((user) => memberIds.has(user.id) || user.isSuperAdmin)
      .map((user) => ({ id: user.id, name: user.name })),
  };
}
