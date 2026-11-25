import type {
  Actor,
  AlertView,
  Dashboard,
  DataMode,
  ItemDetail,
  ItemSummary,
  LocationDetail,
  LocationOption,
  LookupResult,
  MagicLinkResult,
  MembershipSummary,
  MovementView,
  PoDetail,
  PoSummary,
  ReceiveInput,
  ReceiveResult,
  StockAction,
  StockResult,
  WarehouseStock,
} from '@/domain/types';

/**
 * The one data boundary every screen talks to. Mock mode and Supabase implement it the same way.
 * Every read is scoped to the signed-in person's active workspace. The Supabase implementation
 * only ever holds the anon key and the user's JWT, so row level security is the real fence.
 */
export interface ShelflyRepository {
  readonly mode: DataMode;

  restore(): Promise<Actor | null>;
  currentActor(): Promise<Actor | null>;
  signInWithPassword(email: string, password: string): Promise<Actor>;
  requestMagicLink(email: string): Promise<MagicLinkResult>;
  consumeMagicLink(token: string): Promise<Actor>;
  signInAsDemo(userId: string): Promise<Actor>;
  signOut(): Promise<void>;

  listMemberships(): Promise<MembershipSummary[]>;
  switchWorkspace(tenantId: string): Promise<Actor>;

  getDashboard(): Promise<Dashboard>;
  listItems(): Promise<ItemSummary[]>;
  getItem(productId: string): Promise<ItemDetail>;
  lookupCode(code: string): Promise<LookupResult>;
  listLocationOptions(): Promise<LocationOption[]>;
  listWarehouses(): Promise<WarehouseStock[]>;
  getLocation(locationId: string): Promise<LocationDetail>;
  listMovements(limit?: number): Promise<MovementView[]>;
  applyStock(action: StockAction): Promise<StockResult>;

  listPurchaseOrders(): Promise<PoSummary[]>;
  getPurchaseOrder(id: string): Promise<PoDetail>;
  sendPurchaseOrder(id: string): Promise<PoSummary>;
  receivePurchaseOrder(input: ReceiveInput): Promise<ReceiveResult>;

  listAlerts(): Promise<AlertView[]>;
  markAlertRead(alertId: string): Promise<void>;
  markAllAlertsRead(): Promise<number>;

  registerPushToken(token: string, platform: string): Promise<void>;
  /** Mock mode: rebuild the demo books. Supabase: a no-op that throws, there is nothing to reset. */
  resetDemo(): Promise<void>;
}
