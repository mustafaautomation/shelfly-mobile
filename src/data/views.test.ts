import { snapshotFor } from '@/data/engine';
import { createDemoDatabase } from '@/data/seed';
import * as views from '@/data/views';

const db = createDemoDatabase(new Date('2026-11-25T16:00:00.000Z'));
const northwind = snapshotFor(db, 'tnt_northwind');
const harbor = snapshotFor(db, 'tnt_harbor');

describe('demo books and views', () => {
  it('matches the web demo: 42 SKUs across three warehouses', () => {
    expect(northwind.products.length + harbor.products.length).toBe(42);
    expect(northwind.warehouses.length + harbor.warehouses.length).toBe(3);
  });

  it('never leaks a row from the other tenant into a snapshot', () => {
    for (const rows of [harbor.products, harbor.stock, harbor.movements, harbor.purchaseOrders, harbor.alerts, harbor.locations]) {
      expect(rows.every((row) => row.tenantId === 'tnt_harbor')).toBe(true);
    }
    expect(harbor.people.map((person) => person.name)).not.toContain('Lena Ortiz');
  });

  it('summarises stock by location and values it at unit cost', () => {
    const warehouses = views.listWarehouses(northwind);
    const fulfillment = warehouses.find((item) => item.id === 'wh_oak_ful')!;
    const pick = fulfillment.locations.find((item) => item.id === 'loc_pick')!;
    const detail = views.locationDetail(northwind, 'loc_pick');
    expect(detail.units).toBe(pick.units);
    expect(detail.items.find((item) => item.productId === 'prd_eth_12')?.qty).toBe(60);
    const value = detail.items.reduce((sum, item) => sum + item.qty * northwind.products.find((p) => p.id === item.productId)!.costCents, 0);
    expect(pick.valueCents).toBe(value);
  });

  it('orders purchase orders partial first, then sent, drafts and received', () => {
    expect(views.listPurchaseOrders(northwind).map((po) => `${po.number}:${po.status}`)).toEqual([
      'NW-1044:partial',
      'NW-1041:sent',
      'NW-1048:draft',
    ]);
  });

  it('shows what is still on order for a low SKU', () => {
    const bags = views.itemDetail(northwind, 'prd_bag_12');
    expect(bags.low).toBe(true);
    expect(bags.openAlertId).not.toBeNull();
    expect(bags.inbound).toEqual([expect.objectContaining({ number: 'NW-1044', remaining: 300 })]);
  });

  it('builds the dashboard numbers from the same rows', () => {
    const board = views.dashboard(northwind);
    expect(board.skuCount).toBe(26);
    expect(board.openPoCount).toBe(2);
    expect(board.inboundUnits).toBe(300 + 80 + 450);
    expect(board.lowItems.every((item) => item.low)).toBe(true);
    expect(board.recent).toHaveLength(6);
  });
});
