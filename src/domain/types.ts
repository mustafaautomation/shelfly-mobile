import type { MovementType, Plan, PoStatus, SeatRole, Unit } from '@/domain/model';

export type DataMode = 'mock' | 'supabase';

export interface Actor {
  userId: string;
  email: string;
  name: string;
  title: string;
  isSuperAdmin: boolean;
  activeTenantId: string | null;
  role: SeatRole | null;
}

export interface MembershipSummary {
  tenantId: string;
  tenantName: string;
  industry: string;
  plan: Plan;
  role: SeatRole;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  industry: string;
  plan: Plan;
}

export interface MagicLinkResult {
  /** Mock mode only: the path the demo inbox would open. Always null against Supabase. */
  demoPath: string | null;
}

export interface ItemSummary {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: Unit;
  barcode: string;
  onHand: number;
  reorderPoint: number;
  low: boolean;
  costCents: number;
  valueCents: number;
  locationCount: number;
}

export interface LocationStock {
  locationId: string;
  locationName: string;
  locationCode: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
}

export interface MovementView {
  id: string;
  type: MovementType;
  productId: string;
  productName: string;
  sku: string;
  unit: Unit;
  qty: number;
  signedQty: number;
  fromLabel: string | null;
  toLabel: string | null;
  reason: string;
  reference: string | null;
  createdByName: string;
  createdAt: string;
}

export interface InboundLine {
  purchaseOrderId: string;
  number: string;
  status: PoStatus;
  remaining: number;
  expectedOn: string | null;
}

export interface ItemDetail extends ItemSummary {
  description: string;
  byLocation: LocationStock[];
  movements: MovementView[];
  inbound: InboundLine[];
  openAlertId: string | null;
}

export interface LocationOption {
  id: string;
  name: string;
  code: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
}

export interface LocationSummary {
  id: string;
  name: string;
  code: string;
  skuCount: number;
  units: number;
  valueCents: number;
}

export interface WarehouseStock {
  id: string;
  name: string;
  code: string;
  city: string;
  units: number;
  valueCents: number;
  locations: LocationSummary[];
}

export interface LocationItem {
  productId: string;
  sku: string;
  name: string;
  unit: Unit;
  qty: number;
  low: boolean;
}

export interface LocationDetail extends LocationSummary {
  warehouseId: string;
  warehouseName: string;
  items: LocationItem[];
}

export interface PoSummary {
  id: string;
  number: string;
  status: PoStatus;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  expectedOn: string | null;
  lineCount: number;
  ordered: number;
  received: number;
  totalCents: number;
  updatedAt: string;
}

export interface PoLineView {
  id: string;
  productId: string;
  sku: string;
  name: string;
  barcode: string;
  unit: Unit;
  qtyOrdered: number;
  qtyReceived: number;
  remaining: number;
  unitCostCents: number;
}

export interface PoDetail extends PoSummary {
  notes: string;
  supplierEmail: string;
  supplierPhone: string;
  lines: PoLineView[];
  receivingLocations: LocationOption[];
}

export interface AlertView {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  unit: Unit;
  onHand: number;
  reorderPoint: number;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface Dashboard {
  workspace: WorkspaceSummary;
  skuCount: number;
  units: number;
  valueCents: number;
  lowCount: number;
  unreadAlerts: number;
  openPoCount: number;
  inboundUnits: number;
  lowItems: ItemSummary[];
  openOrders: PoSummary[];
  recent: MovementView[];
  warehouses: { id: string; name: string; units: number; valueCents: number }[];
}

export type LookupResult =
  | { kind: 'item'; item: ItemSummary; matchedBy: 'barcode' | 'sku' | 'link' }
  | { kind: 'none'; code: string; message: string };

export type StockAction =
  | { type: 'adjust'; productId: string; locationId: string; delta: number; reason: string }
  | { type: 'transfer'; productId: string; fromLocationId: string; toLocationId: string; qty: number; reason: string }
  | { type: 'receive'; productId: string; locationId: string; qty: number; reason: string };

export interface StockResult {
  movement: MovementView;
  onHand: number;
  /** Set when this movement pushed the SKU to or below its reorder point and opened a new alert. */
  newAlert: AlertView | null;
}

export interface ReceiveInput {
  purchaseOrderId: string;
  locationId: string;
  lines: { lineId: string; qty: number }[];
}

export interface ReceiveResult {
  order: PoSummary;
  unitsReceived: number;
}
