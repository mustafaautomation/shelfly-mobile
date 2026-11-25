import { ShelflyError } from '@/domain/errors';
import type { Persistence } from '@/data/persistence';
import type { ShelflyRepository } from '@/data/repository';

const CACHE_KEY = 'shelfly.read-cache';

export interface CacheFlags {
  mark(stale: boolean): void;
}

async function readBlob(persistence: Persistence): Promise<Record<string, string>> {
  const raw = await persistence.get(CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Offline-friendly reads. Every successful read is saved per person and workspace; when the
 * device is offline (or the backend does not answer) the last saved copy is served and the UI
 * shows a banner. Writes never queue silently: a stock change needs the live books.
 */
export function withReadCache(
  inner: ShelflyRepository,
  persistence: Persistence,
  flags: CacheFlags,
  isOnline: () => boolean = () => true,
): ShelflyRepository {
  async function scopedKey(key: string): Promise<string> {
    const actor = await inner.currentActor();
    return `${actor?.userId ?? 'anon'}:${actor?.activeTenantId ?? 'none'}:${key}`;
  }

  async function read<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cacheKey = await scopedKey(key);
    const blob = await readBlob(persistence);
    if (!isOnline()) {
      const hit = blob[cacheKey];
      if (hit) {
        flags.mark(true);
        return JSON.parse(hit) as T;
      }
      throw new ShelflyError('offline', 'You are offline and this screen has not been saved on this device yet.');
    }
    try {
      const value = await fetcher();
      blob[cacheKey] = JSON.stringify(value);
      await persistence.set(CACHE_KEY, JSON.stringify(blob));
      flags.mark(false);
      return value;
    } catch (error) {
      const recoverable =
        !(error instanceof ShelflyError) ||
        error.code === 'network' ||
        error.code === 'offline';
      const hit = blob[cacheKey];
      if (recoverable && hit) {
        flags.mark(true);
        return JSON.parse(hit) as T;
      }
      throw error;
    }
  }

  async function write<T>(work: () => Promise<T>): Promise<T> {
    if (!isOnline()) {
      throw new ShelflyError('offline', 'You are offline. Stock changes need a connection so two people never post the same count.');
    }
    const result = await work();
    await persistence.remove(CACHE_KEY);
    return result;
  }

  return {
    mode: inner.mode,
    restore: () => inner.restore(),
    currentActor: () => inner.currentActor(),
    signInWithPassword: (email, password) => inner.signInWithPassword(email, password),
    requestMagicLink: (email) => inner.requestMagicLink(email),
    consumeMagicLink: (token) => inner.consumeMagicLink(token),
    signInAsDemo: (userId) => inner.signInAsDemo(userId),
    signOut: () => inner.signOut(),
    listMemberships: () => read('memberships', () => inner.listMemberships()),
    switchWorkspace: (tenantId) => inner.switchWorkspace(tenantId),
    getDashboard: () => read('dashboard', () => inner.getDashboard()),
    listItems: () => read('items', () => inner.listItems()),
    getItem: (id) => read(`item:${id}`, () => inner.getItem(id)),
    lookupCode: (code) => read(`lookup:${code.trim()}`, () => inner.lookupCode(code)),
    listLocationOptions: () => read('location-options', () => inner.listLocationOptions()),
    listWarehouses: () => read('warehouses', () => inner.listWarehouses()),
    getLocation: (id) => read(`location:${id}`, () => inner.getLocation(id)),
    listMovements: (limit) => read(`movements:${limit ?? 'all'}`, () => inner.listMovements(limit)),
    applyStock: (action) => write(() => inner.applyStock(action)),
    listPurchaseOrders: () => read('orders', () => inner.listPurchaseOrders()),
    getPurchaseOrder: (id) => read(`order:${id}`, () => inner.getPurchaseOrder(id)),
    sendPurchaseOrder: (id) => write(() => inner.sendPurchaseOrder(id)),
    receivePurchaseOrder: (input) => write(() => inner.receivePurchaseOrder(input)),
    listAlerts: () => read('alerts', () => inner.listAlerts()),
    markAlertRead: (id) => write(() => inner.markAlertRead(id)),
    markAllAlertsRead: () => write(() => inner.markAllAlertsRead()),
    registerPushToken: (token, platform) => inner.registerPushToken(token, platform),
    resetDemo: () => write(() => inner.resetDemo()),
  };
}
