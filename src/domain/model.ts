/**
 * Shelfly's tenant-scoped records. These mirror the web app's `lib/model.ts` and the
 * Supabase tables in `supabase/migrations/20261125120000_shelfly_init.sql`
 * (snake_case columns there, camelCase here). Money is integer cents, quantities are integers.
 */
export const UNITS = ['each', 'lb', 'kg', 'bag', 'case', 'oz', 'qt'] as const;
export type Unit = (typeof UNITS)[number];

export const ROLES = ['owner', 'warehouse_staff', 'viewer'] as const;
export type Role = (typeof ROLES)[number];
/** A super admin is not a membership row, but the app treats it as a seat on every workspace. */
export type SeatRole = Role | 'super_admin';

export type Plan = 'starter' | 'pro';
export type MovementType = 'receive' | 'adjust' | 'transfer';
export type PoStatus = 'draft' | 'sent' | 'partial' | 'received';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry: string;
  plan: Plan;
  createdAt: string;
}

export interface Person {
  id: string;
  email: string;
  name: string;
  title: string;
  isSuperAdmin: boolean;
}

export interface Membership {
  id: string;
  tenantId: string;
  userId: string;
  role: Role;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string;
  city: string;
}

export interface Location {
  id: string;
  tenantId: string;
  warehouseId: string;
  name: string;
  code: string;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description: string;
  barcode: string;
  category: string;
  unit: Unit;
  costCents: number;
  reorderPoint: number;
  createdAt: string;
}

export interface StockLevel {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  qty: number;
}

export interface Movement {
  id: string;
  tenantId: string;
  type: MovementType;
  productId: string;
  qty: number;
  signedQty: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  reason: string;
  reference: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  number: string;
  supplierId: string;
  warehouseId: string;
  status: PoStatus;
  notes: string;
  expectedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoLine {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  productId: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCostCents: number;
}

export interface Alert {
  id: string;
  tenantId: string;
  productId: string;
  kind: 'low_stock';
  message: string;
  createdAt: string;
  readAt: string | null;
}

/** Everything one workspace needs to render. Mock mode and Supabase both produce this shape. */
export interface TenantSnapshot {
  tenant: Tenant;
  warehouses: Warehouse[];
  locations: Location[];
  products: Product[];
  stock: StockLevel[];
  movements: Movement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poLines: PoLine[];
  alerts: Alert[];
  people: Pick<Person, 'id' | 'name'>[];
}
