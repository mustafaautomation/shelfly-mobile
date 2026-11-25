import { ShelflyError } from '@/domain/errors';
import type { Actor, MembershipSummary, StockResult } from '@/domain/types';
import {
  MOCK_DB_VERSION,
  markAlertRead,
  nextId,
  postAdjust,
  postReceive,
  postTransfer,
  receivePurchaseOrder,
  seatFor,
  sendPurchaseOrder,
  snapshotFor,
  totalOnHand,
  type EngineActor,
  type MockDatabase,
  type MovementOutcome,
} from '@/data/engine';
import type { Persistence } from '@/data/persistence';
import type { ShelflyRepository } from '@/data/repository';
import { createDemoDatabase } from '@/data/seed';
import * as views from '@/data/views';

const DB_KEY = 'shelfly.mock-db';
const SESSION_KEY = 'shelfly.session.mock';

interface MockSession {
  userId: string;
  activeTenantId: string | null;
}

export interface MockOptions {
  persistence: Persistence;
  now?: () => Date;
  /** Simulated network latency so loading states are real on the web preview. Zero in tests. */
  latencyMs?: number;
}

export function createMockRepository({ persistence, now = () => new Date(), latencyMs = 0 }: MockOptions): ShelflyRepository {
  let db: MockDatabase | null = null;
  let session: MockSession | null = null;
  let loaded = false;

  const wait = () => (latencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, latencyMs)) : Promise.resolve());

  async function load(): Promise<MockDatabase> {
    if (db && loaded) return db;
    const raw = await persistence.get(DB_KEY);
    let parsed: MockDatabase | null = null;
    if (raw) {
      try {
        const candidate = JSON.parse(raw) as MockDatabase;
        if (candidate.version === MOCK_DB_VERSION) parsed = candidate;
      } catch {
        parsed = null;
      }
    }
    db = parsed ?? createDemoDatabase(now());
    if (!parsed) await persistence.set(DB_KEY, JSON.stringify(db));
    const rawSession = await persistence.get(SESSION_KEY);
    if (rawSession) {
      try {
        session = JSON.parse(rawSession) as MockSession;
      } catch {
        session = null;
      }
    }
    loaded = true;
    return db;
  }

  async function save(): Promise<void> {
    if (db) await persistence.set(DB_KEY, JSON.stringify(db));
  }

  async function saveSession(next: MockSession | null): Promise<void> {
    session = next;
    if (next) await persistence.set(SESSION_KEY, JSON.stringify(next));
    else await persistence.remove(SESSION_KEY);
  }

  function memberships(data: MockDatabase, userId: string): MembershipSummary[] {
    const user = data.users.find((item) => item.id === userId);
    if (!user) return [];
    const tenants = user.isSuperAdmin
      ? data.tenants
      : data.tenants.filter((tenant) => data.memberships.some((m) => m.userId === userId && m.tenantId === tenant.id));
    return tenants
      .map((tenant) => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
        industry: tenant.industry,
        plan: tenant.plan,
        role: seatFor(data, userId, tenant.id)!,
      }))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  }

  function actorFor(data: MockDatabase, current: MockSession): Actor | null {
    const user = data.users.find((item) => item.id === current.userId);
    if (!user) return null;
    const seats = memberships(data, user.id);
    const activeTenantId = seats.some((seat) => seat.tenantId === current.activeTenantId)
      ? current.activeTenantId
      : (seats[0]?.tenantId ?? null);
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      title: user.title,
      isSuperAdmin: user.isSuperAdmin,
      activeTenantId,
      role: activeTenantId ? seatFor(data, user.id, activeTenantId) : null,
    };
  }

  async function startSession(userId: string): Promise<Actor> {
    const data = await load();
    const seats = memberships(data, userId);
    const preferred = seats.find((seat) => seat.tenantId === 'tnt_northwind') ?? seats[0];
    await saveSession({ userId, activeTenantId: preferred?.tenantId ?? null });
    return actorFor(data, session!)!;
  }

  async function context(): Promise<{ data: MockDatabase; actor: EngineActor; tenantId: string }> {
    const data = await load();
    if (!session) throw new ShelflyError('unauthenticated', 'Sign in to open your workspace.');
    const actor = actorFor(data, session);
    if (!actor) throw new ShelflyError('unauthenticated', 'Sign in to open your workspace.');
    if (!actor.activeTenantId) throw new ShelflyError('forbidden', 'Your account does not have a workspace seat yet.');
    await wait();
    return { data, actor: { userId: actor.userId, role: actor.role }, tenantId: actor.activeTenantId };
  }

  async function snapshot() {
    const { data, tenantId } = await context();
    return snapshotFor(data, tenantId);
  }

  function stockResult(data: MockDatabase, tenantId: string, outcome: MovementOutcome): StockResult {
    const snap = snapshotFor(data, tenantId);
    return {
      movement: views.movementView(snap, outcome.movement),
      onHand: totalOnHand(data, outcome.movement.productId),
      newAlert: outcome.alert ? views.alertView(snap, outcome.alert) : null,
    };
  }

  return {
    mode: 'mock',

    async restore() {
      const data = await load();
      return session ? actorFor(data, session) : null;
    },

    async currentActor() {
      const data = await load();
      return session ? actorFor(data, session) : null;
    },

    async signInWithPassword(email, password) {
      const data = await load();
      await wait();
      const user = data.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || user.password !== password) {
        throw new ShelflyError('unauthenticated', 'That email and password do not match a Shelfly seat.');
      }
      return startSession(user.id);
    },

    async requestMagicLink(email) {
      const data = await load();
      await wait();
      const user = data.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) return { demoPath: null };
      const token = `ml_${nextId(data, 'tok')}_${Math.random().toString(36).slice(2, 10)}`;
      data.magicLinks.push({ token, userId: user.id, expiresAt: new Date(now().getTime() + 15 * 60_000).toISOString() });
      await save();
      return { demoPath: `/auth/callback?token=${encodeURIComponent(token)}` };
    },

    async consumeMagicLink(token) {
      const data = await load();
      const link = data.magicLinks.find((item) => item.token === token);
      if (!link) throw new ShelflyError('unauthenticated', 'That sign-in link was already used or does not exist.');
      data.magicLinks = data.magicLinks.filter((item) => item.token !== token);
      await save();
      if (Date.parse(link.expiresAt) < now().getTime()) {
        throw new ShelflyError('unauthenticated', 'That sign-in link expired. Ask for a new one.');
      }
      return startSession(link.userId);
    },

    async signInAsDemo(userId) {
      const data = await load();
      if (!data.users.some((item) => item.id === userId)) throw new ShelflyError('not_found', 'That demo seat does not exist.');
      return startSession(userId);
    },

    async signOut() {
      await load();
      await saveSession(null);
    },

    async listMemberships() {
      const data = await load();
      if (!session) return [];
      return memberships(data, session.userId);
    },

    async switchWorkspace(tenantId) {
      const data = await load();
      if (!session) throw new ShelflyError('unauthenticated', 'Sign in to switch workspaces.');
      if (!seatFor(data, session.userId, tenantId)) throw new ShelflyError('forbidden', 'You do not have a seat in that workspace.');
      await saveSession({ ...session, activeTenantId: tenantId });
      return actorFor(data, session!)!;
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
      const { data, actor, tenantId } = await context();
      const at = now().toISOString();
      let outcome: MovementOutcome;
      if (action.type === 'adjust') {
        if (!action.reason.trim()) throw new ShelflyError('invalid', 'Give a reason for the adjustment.');
        outcome = postAdjust(data, actor, { tenantId, productId: action.productId, locationId: action.locationId, delta: action.delta, reason: action.reason, at });
      } else if (action.type === 'transfer') {
        outcome = postTransfer(data, actor, { tenantId, productId: action.productId, fromLocationId: action.fromLocationId, toLocationId: action.toLocationId, qty: action.qty, reason: action.reason, at });
      } else {
        outcome = postReceive(data, actor, { tenantId, productId: action.productId, locationId: action.locationId, qty: action.qty, reason: action.reason, at });
      }
      await save();
      return stockResult(data, tenantId, outcome);
    },

    listPurchaseOrders: async () => views.listPurchaseOrders(await snapshot()),
    getPurchaseOrder: async (id) => views.poDetail(await snapshot(), id),

    async sendPurchaseOrder(id) {
      const { data, actor, tenantId } = await context();
      sendPurchaseOrder(data, actor, { tenantId, purchaseOrderId: id, at: now().toISOString() });
      await save();
      return views.poSummary(snapshotFor(data, tenantId), id);
    },

    async receivePurchaseOrder(input) {
      const { data, actor, tenantId } = await context();
      const result = receivePurchaseOrder(data, actor, {
        tenantId,
        purchaseOrderId: input.purchaseOrderId,
        locationId: input.locationId,
        lines: input.lines,
        at: now().toISOString(),
      });
      await save();
      return { order: views.poSummary(snapshotFor(data, tenantId), result.po.id), unitsReceived: result.units };
    },

    listAlerts: async () => views.listAlerts(await snapshot()),

    async markAlertRead(alertId) {
      const { data, actor, tenantId } = await context();
      markAlertRead(data, actor, { tenantId, alertId, at: now().toISOString() });
      await save();
    },

    async markAllAlertsRead() {
      const { data, actor, tenantId } = await context();
      const open = data.alerts.filter((alert) => alert.tenantId === tenantId && !alert.readAt);
      const at = now().toISOString();
      for (const alert of open) markAlertRead(data, actor, { tenantId, alertId: alert.id, at });
      await save();
      return open.length;
    },

    async registerPushToken(token, platform) {
      const data = await load();
      if (!session) return;
      const userId = session.userId;
      data.pushTokens = data.pushTokens.filter((item) => !(item.userId === userId && item.platform === platform));
      data.pushTokens.push({ userId, token, platform });
      await save();
    },

    async resetDemo() {
      db = createDemoDatabase(now());
      loaded = true;
      await save();
    },
  };
}
