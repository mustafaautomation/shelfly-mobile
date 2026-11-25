import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { ShelflyError } from '@/domain/errors';
import type {
  Alert,
  Location,
  Movement,
  PoLine,
  Product,
  PurchaseOrder,
  Role,
  SeatRole,
  StockLevel,
  Supplier,
  Tenant,
  TenantSnapshot,
  Warehouse,
} from '@/domain/model';
import type { Actor, MembershipSummary } from '@/domain/types';
import type { Persistence } from '@/data/persistence';
import type { ShelflyRepository } from '@/data/repository';
import * as views from '@/data/views';

interface SupabaseEnv {
  url: string;
  anonKey: string;
}

type Row = Record<string, unknown>;

const ACTIVE_KEY = 'shelfly.active-tenant';

/** Turns a PostgREST or auth error into a ShelflyError. The SQL functions raise plain-English messages. */
function fail(error: { message?: string; code?: string } | null | undefined, fallback: string): void {
  if (!error) return;
  const message = error.message ?? fallback;
  const lower = message.toLowerCase();
  if (lower.includes('fetch') || lower.includes('network')) throw new ShelflyError('network', 'Shelfly could not reach the server.');
  if (lower.includes('jwt') || lower.includes('sign in required') || lower.includes('invalid login')) {
    throw new ShelflyError('unauthenticated', lower.includes('invalid login') ? 'That email and password do not match a Shelfly seat.' : 'Sign in again to continue.');
  }
  if (lower.includes('cannot change') || lower.includes('permission denied') || error.code === '42501') {
    throw new ShelflyError('forbidden', message);
  }
  if (lower.includes('stock') || lower.includes('quantity') || lower.includes('remaining') || lower.includes('location')) {
    throw new ShelflyError('stock', message);
  }
  throw new ShelflyError('invalid', message || fallback);
}

const str = (row: Row, key: string) => String(row[key] ?? '');
const num = (row: Row, key: string) => Number(row[key] ?? 0);
const opt = (row: Row, key: string) => (row[key] == null ? null : String(row[key]));

const toTenant = (r: Row): Tenant => ({ id: str(r, 'id'), name: str(r, 'name'), slug: str(r, 'slug'), industry: str(r, 'industry'), plan: str(r, 'plan') === 'pro' ? 'pro' : 'starter', createdAt: str(r, 'created_at') });
const toWarehouse = (r: Row): Warehouse => ({ id: str(r, 'id'), tenantId: str(r, 'tenant_id'), name: str(r, 'name'), code: str(r, 'code'), address: str(r, 'address'), city: str(r, 'city') });
const toLocation = (r: Row): Location => ({ id: str(r, 'id'), tenantId: str(r, 'tenant_id'), warehouseId: str(r, 'warehouse_id'), name: str(r, 'name'), code: str(r, 'code') });
const toProduct = (r: Row): Product => ({
  id: str(r, 'id'),
  tenantId: str(r, 'tenant_id'),
  sku: str(r, 'sku'),
  name: str(r, 'name'),
  description: str(r, 'description'),
  barcode: str(r, 'barcode'),
  category: str(r, 'category'),
  unit: str(r, 'unit') as Product['unit'],
  costCents: num(r, 'cost_cents'),
  reorderPoint: num(r, 'reorder_point'),
  createdAt: str(r, 'created_at'),
});
const toStock = (r: Row): StockLevel => ({ id: str(r, 'id'), tenantId: str(r, 'tenant_id'), productId: str(r, 'product_id'), locationId: str(r, 'location_id'), qty: num(r, 'qty') });
const toMovement = (r: Row): Movement => ({
  id: str(r, 'id'),
  tenantId: str(r, 'tenant_id'),
  type: str(r, 'type') as Movement['type'],
  productId: str(r, 'product_id'),
  qty: num(r, 'qty'),
  signedQty: num(r, 'signed_qty'),
  fromLocationId: opt(r, 'from_location_id'),
  toLocationId: opt(r, 'to_location_id'),
  reason: str(r, 'reason'),
  reference: opt(r, 'reference'),
  createdBy: opt(r, 'created_by'),
  createdAt: str(r, 'created_at'),
});
const toSupplier = (r: Row): Supplier => ({ id: str(r, 'id'), tenantId: str(r, 'tenant_id'), name: str(r, 'name'), email: str(r, 'email'), phone: str(r, 'phone'), address: str(r, 'address'), notes: str(r, 'notes') });
const toPo = (r: Row): PurchaseOrder => ({
  id: str(r, 'id'),
  tenantId: str(r, 'tenant_id'),
  number: str(r, 'number'),
  supplierId: str(r, 'supplier_id'),
  warehouseId: str(r, 'warehouse_id'),
  status: str(r, 'status') as PurchaseOrder['status'],
  notes: str(r, 'notes'),
  expectedOn: opt(r, 'expected_on'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});
const toLine = (r: Row): PoLine => ({ id: str(r, 'id'), tenantId: str(r, 'tenant_id'), purchaseOrderId: str(r, 'purchase_order_id'), productId: str(r, 'product_id'), qtyOrdered: num(r, 'qty_ordered'), qtyReceived: num(r, 'qty_received'), unitCostCents: num(r, 'unit_cost_cents') });
const toAlert = (r: Row): Alert => ({ id: str(r, 'id'), tenantId: str(r, 'tenant_id'), productId: str(r, 'product_id'), kind: 'low_stock', message: str(r, 'message'), createdAt: str(r, 'created_at'), readAt: opt(r, 'read_at') });

export function createSupabaseRepository(env: SupabaseEnv, persistence: Persistence): ShelflyRepository {
  let client: SupabaseClient | null = null;

  function sb(): SupabaseClient {
    if (!client) {
      client = createClient(env.url, env.anonKey, {
        auth: {
          storage: {
            getItem: (key) => persistence.get(key),
            setItem: (key, value) => persistence.set(key, value),
            removeItem: (key) => persistence.remove(key),
          },
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
    }
    return client;
  }

  async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, fallback: string): Promise<Row[]> {
    const { data, error } = await query;
    fail(error, fallback);
    return (data as Row[] | null) ?? [];
  }

  async function seats(userId: string, isSuperAdmin: boolean): Promise<MembershipSummary[]> {
    if (isSuperAdmin) {
      const tenants = await rows(sb().from('tenants').select('id, name, slug, industry, plan, created_at').order('name'), 'Workspaces could not be loaded.');
      return tenants.map((t) => ({ tenantId: str(t, 'id'), tenantName: str(t, 'name'), industry: str(t, 'industry'), plan: str(t, 'plan') === 'pro' ? 'pro' : 'starter', role: 'super_admin' as SeatRole }));
    }
    const data = await rows(
      sb().from('memberships').select('tenant_id, role, tenants(name, industry, plan)').eq('user_id', userId),
      'Your workspaces could not be loaded.',
    );
    return data
      .map((row) => {
        const tenant = (row.tenants ?? {}) as Row;
        return {
          tenantId: str(row, 'tenant_id'),
          tenantName: str(tenant, 'name'),
          industry: str(tenant, 'industry'),
          plan: (str(tenant, 'plan') === 'pro' ? 'pro' : 'starter') as MembershipSummary['plan'],
          role: str(row, 'role') as Role,
        };
      })
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  }

  async function loadActor(): Promise<Actor | null> {
    const { data, error } = await sb().auth.getSession();
    fail(error, 'Sign in to open your workspace.');
    const user = data.session?.user;
    if (!user) return null;
    const profileRows = await rows(sb().from('profiles').select('id, email, full_name, title, is_super_admin').eq('id', user.id), 'Your profile could not be loaded.');
    const profile = profileRows[0] ?? { id: user.id, email: user.email ?? '', full_name: '', title: '', is_super_admin: false };
    const isSuperAdmin = profile.is_super_admin === true;
    const list = await seats(user.id, isSuperAdmin);
    const saved = await persistence.get(`${ACTIVE_KEY}.${user.id}`);
    const active = list.find((seat) => seat.tenantId === saved) ?? list[0] ?? null;
    return {
      userId: user.id,
      email: str(profile, 'email') || (user.email ?? ''),
      name: str(profile, 'full_name') || (user.email ?? 'Shelfly user'),
      title: str(profile, 'title'),
      isSuperAdmin,
      activeTenantId: active?.tenantId ?? null,
      role: active?.role ?? null,
    };
  }

  async function requireTenant(): Promise<{ actor: Actor; tenantId: string }> {
    const actor = await loadActor();
    if (!actor) throw new ShelflyError('unauthenticated', 'Sign in to open your workspace.');
    if (!actor.activeTenantId) throw new ShelflyError('forbidden', 'Your account does not have a workspace seat yet.');
    return { actor, tenantId: actor.activeTenantId };
  }

  async function snapshot(): Promise<TenantSnapshot> {
    const { tenantId } = await requireTenant();
    const scoped = (table: string, columns = '*') => sb().from(table).select(columns).eq('tenant_id', tenantId);
    const [tenantRows, warehouses, locations, products, stock, movements, suppliers, orders, lines, alerts, members] = await Promise.all([
      rows(sb().from('tenants').select('*').eq('id', tenantId), 'This workspace could not be opened.'),
      rows(scoped('warehouses'), 'Warehouses could not be loaded.'),
      rows(scoped('locations'), 'Locations could not be loaded.'),
      rows(scoped('products').order('name'), 'The catalog could not be loaded.'),
      rows(scoped('stock_levels'), 'Stock could not be loaded.'),
      rows(scoped('movements').order('created_at', { ascending: false }).limit(300), 'Movements could not be loaded.'),
      rows(scoped('suppliers'), 'Suppliers could not be loaded.'),
      rows(scoped('purchase_orders'), 'Purchase orders could not be loaded.'),
      rows(scoped('po_lines'), 'Purchase order lines could not be loaded.'),
      rows(scoped('alerts').order('created_at', { ascending: false }).limit(200), 'Alerts could not be loaded.'),
      rows(scoped('memberships', 'user_id, profiles(id, full_name)'), 'People could not be loaded.'),
    ]);
    if (!tenantRows[0]) throw new ShelflyError('forbidden', 'You do not belong to this workspace.');
    return {
      tenant: toTenant(tenantRows[0]),
      warehouses: warehouses.map(toWarehouse),
      locations: locations.map(toLocation),
      products: products.map(toProduct),
      stock: stock.map(toStock),
      movements: movements.map(toMovement),
      suppliers: suppliers.map(toSupplier),
      purchaseOrders: orders.map(toPo),
      poLines: lines.map(toLine),
      alerts: alerts.map(toAlert),
      people: members.map((row) => {
        const profile = (row.profiles ?? {}) as Row;
        return { id: str(row, 'user_id'), name: str(profile, 'full_name') || 'Teammate' };
      }),
    };
  }

  return {
    mode: 'supabase',
    restore: () => loadActor(),
    currentActor: () => loadActor(),

    async signInWithPassword(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      fail(error, 'That email and password do not match a Shelfly seat.');
      const actor = await loadActor();
      if (!actor) throw new ShelflyError('unauthenticated', 'Sign in did not finish.');
      return actor;
    },

    async requestMagicLink(email) {
      const { error } = await sb().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: Linking.createURL('/auth/callback') },
      });
      // Unknown addresses get the same answer, so this screen never confirms who has a seat.
      if (error && !/not found|signups not allowed/i.test(error.message)) fail(error, 'The link could not be sent.');
      return { demoPath: null };
    },

    async consumeMagicLink(token) {
      const exchanged = await sb().auth.exchangeCodeForSession(token);
      if (exchanged.error) {
        const verified = await sb().auth.verifyOtp({ token_hash: token, type: 'email' });
        fail(verified.error, 'That sign-in link expired or was already used.');
      }
      const actor = await loadActor();
      if (!actor) throw new ShelflyError('unauthenticated', 'That sign-in link expired or was already used.');
      return actor;
    },

    async signInAsDemo() {
      throw new ShelflyError('invalid', 'Demo seats are off while Shelfly is connected to Supabase. Sign in with your account.');
    },

    async signOut() {
      await sb().auth.signOut();
    },

    async listMemberships() {
      const actor = await loadActor();
      return actor ? seats(actor.userId, actor.isSuperAdmin) : [];
    },

    async switchWorkspace(tenantId) {
      const actor = await loadActor();
      if (!actor) throw new ShelflyError('unauthenticated', 'Sign in to switch workspaces.');
      const list = await seats(actor.userId, actor.isSuperAdmin);
      if (!list.some((seat) => seat.tenantId === tenantId)) throw new ShelflyError('forbidden', 'You do not have a seat in that workspace.');
      await persistence.set(`${ACTIVE_KEY}.${actor.userId}`, tenantId);
      return (await loadActor())!;
    },

    getDashboard: async () => views.dashboard(await snapshot()),
    listItems: async () => views.listItems(await snapshot()),
    getItem: async (id) => views.itemDetail(await snapshot(), id),
    lookupCode: async (code) => views.lookupCode(await snapshot(), code),
    listLocationOptions: async () => views.locationOptions(await snapshot()),
    listWarehouses: async () => views.listWarehouses(await snapshot()),
    getLocation: async (id) => views.locationDetail(await snapshot(), id),
    listMovements: async (limit) => views.listMovements(await snapshot(), limit),

    async applyStock(action) {
      const { tenantId } = await requireTenant();
      const startedAt = Date.now();
      const args =
        action.type === 'transfer'
          ? { p_type: 'transfer', p_signed_qty: action.qty, p_from_location_id: action.fromLocationId, p_to_location_id: action.toLocationId }
          : action.type === 'receive'
            ? { p_type: 'receive', p_signed_qty: action.qty, p_from_location_id: null, p_to_location_id: action.locationId }
            : {
                p_type: 'adjust',
                p_signed_qty: action.delta,
                p_from_location_id: action.delta < 0 ? action.locationId : null,
                p_to_location_id: action.delta > 0 ? action.locationId : null,
              };
      const { data, error } = await sb().rpc('apply_movement', {
        p_tenant_id: tenantId,
        p_product_id: action.productId,
        p_reason: action.reason,
        p_reference: null,
        ...args,
      });
      fail(error, 'The stock change was not saved.');
      const snap = await snapshot();
      const moved = toMovement((data ?? {}) as Row);
      const alert = snap.alerts.find(
        (item) => item.productId === action.productId && !item.readAt && Date.parse(item.createdAt) >= startedAt - 60_000,
      );
      return {
        movement: views.movementView(snap, snap.movements.find((m) => m.id === moved.id) ?? moved),
        onHand: views.itemSummary(snap, snap.products.find((p) => p.id === action.productId)!).onHand,
        newAlert: alert ? views.alertView(snap, alert) : null,
      };
    },

    listPurchaseOrders: async () => views.listPurchaseOrders(await snapshot()),
    getPurchaseOrder: async (id) => views.poDetail(await snapshot(), id),

    async sendPurchaseOrder(id) {
      const snap = await snapshot();
      const detail = views.poDetail(snap, id);
      if (detail.status !== 'draft') throw new ShelflyError('invalid', 'Only draft orders can be sent.');
      if (detail.lines.length === 0) throw new ShelflyError('invalid', 'Add at least one line before sending.');
      const { error } = await sb()
        .from('purchase_orders')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', snap.tenant.id)
        .eq('status', 'draft');
      fail(error, 'The order was not sent.');
      return views.poSummary(await snapshot(), id);
    },

    async receivePurchaseOrder(input) {
      const { tenantId } = await requireTenant();
      const lines = input.lines.filter((line) => line.qty !== 0);
      const { error } = await sb().rpc('receive_purchase_order', {
        p_tenant_id: tenantId,
        p_purchase_order_id: input.purchaseOrderId,
        p_location_id: input.locationId,
        p_lines: lines.map((line) => ({ line_id: line.lineId, qty: line.qty })),
      });
      fail(error, 'The receipt was not saved.');
      return {
        order: views.poSummary(await snapshot(), input.purchaseOrderId),
        unitsReceived: lines.reduce((sum, line) => sum + line.qty, 0),
      };
    },

    listAlerts: async () => views.listAlerts(await snapshot()),

    async markAlertRead(alertId) {
      const { tenantId } = await requireTenant();
      const { error } = await sb().from('alerts').update({ read_at: new Date().toISOString() }).eq('id', alertId).eq('tenant_id', tenantId);
      fail(error, 'The alert could not be updated.');
    },

    async markAllAlertsRead() {
      const { tenantId } = await requireTenant();
      const { data, error } = await sb()
        .from('alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .is('read_at', null)
        .select('id');
      fail(error, 'Alerts could not be updated.');
      return ((data as Row[] | null) ?? []).length;
    },

    async registerPushToken(token, platform) {
      const actor = await loadActor();
      if (!actor) return;
      const { error } = await sb()
        .from('push_tokens')
        .upsert({ user_id: actor.userId, token, platform, updated_at: new Date().toISOString() }, { onConflict: 'user_id,platform' });
      fail(error, 'This device could not be registered for alerts.');
    },

    async resetDemo() {
      throw new ShelflyError('invalid', 'There is no demo to reset while Shelfly is connected to Supabase.');
    },
  };
}
