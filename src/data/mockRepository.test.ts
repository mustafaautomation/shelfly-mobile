import { createMockRepository } from '@/data/mockRepository';
import { createMemoryPersistence } from '@/data/persistence';
import { ShelflyError } from '@/domain/errors';

const NOW = new Date('2026-11-25T16:00:00.000Z');

function setup() {
  const persistence = createMemoryPersistence();
  const repo = createMockRepository({ persistence, now: () => NOW });
  return { repo, persistence };
}

async function rejectsWith(promise: Promise<unknown>, code: ShelflyError['code'], text?: RegExp) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ShelflyError);
  expect((error as ShelflyError).code).toBe(code);
  if (text) expect((error as ShelflyError).message).toMatch(text);
}

describe('mock repository', () => {
  it('signs in with the demo password and opens Northwind for Lena', async () => {
    const { repo } = setup();
    const actor = await repo.signInWithPassword('floor@northwind.demo', 'shelfly-demo');
    expect(actor).toMatchObject({ name: 'Lena Ortiz', role: 'warehouse_staff', activeTenantId: 'tnt_northwind' });
    const board = await repo.getDashboard();
    expect(board.workspace.name).toBe('Northwind Coffee Roasters');
    expect(board.skuCount).toBe(26);
    expect(board.lowCount).toBeGreaterThan(0);
    expect(board.openPoCount).toBe(2);
  });

  it('rejects a wrong password without saying which half was wrong', async () => {
    const { repo } = setup();
    await rejectsWith(repo.signInWithPassword('floor@northwind.demo', 'nope'), 'unauthenticated', /do not match/);
    await rejectsWith(repo.signInWithPassword('nobody@example.com', 'shelfly-demo'), 'unauthenticated', /do not match/);
  });

  it('keeps Harbor and Northwind apart', async () => {
    const { repo } = setup();
    await repo.signInAsDemo('usr_hb_owner');
    const items = await repo.listItems();
    expect(items).toHaveLength(16);
    expect(items.every((item) => item.sku.startsWith('HB-'))).toBe(true);
    await rejectsWith(repo.getItem('prd_eth_green'), 'not_found');
    const lookup = await repo.lookupCode('840011000001');
    expect(lookup.kind).toBe('none');
    await rejectsWith(repo.switchWorkspace('tnt_northwind'), 'forbidden');
  });

  it('finds a SKU by barcode, by EAN-13 with a leading zero, and by SKU', async () => {
    const { repo } = setup();
    await repo.signInAsDemo('usr_nw_staff');
    const upc = await repo.lookupCode('840011000017');
    const ean = await repo.lookupCode('0840011000017');
    const sku = await repo.lookupCode('nw-pk-12');
    for (const result of [upc, ean, sku]) {
      expect(result.kind).toBe('item');
      if (result.kind === 'item') expect(result.item.name).toBe('12oz Kraft Bags');
    }
  });

  it('adjusts stock with a reason, writes the ledger, and opens a low-stock alert', async () => {
    const { repo } = setup();
    await repo.signInAsDemo('usr_nw_staff');
    const before = await repo.getItem('prd_eth_12');
    expect(before.onHand).toBe(60);
    const result = await repo.applyStock({ type: 'adjust', productId: 'prd_eth_12', locationId: 'loc_pick', delta: -25, reason: 'Damaged in transit' });
    expect(result.onHand).toBe(35);
    expect(result.movement).toMatchObject({ type: 'adjust', signedQty: -25, reason: 'Damaged in transit', createdByName: 'Lena Ortiz' });
    expect(result.newAlert?.productName).toBe('Ethiopia 12oz');
    const after = await repo.getItem('prd_eth_12');
    expect(after.low).toBe(true);
    expect(after.movements[0].reason).toBe('Damaged in transit');
    await rejectsWith(
      repo.applyStock({ type: 'adjust', productId: 'prd_eth_12', locationId: 'loc_pick', delta: -1, reason: '  ' }),
      'invalid',
      /reason/,
    );
  });

  it('refuses a transfer the source cannot cover and moves stock when it can', async () => {
    const { repo } = setup();
    await repo.signInAsDemo('usr_nw_staff');
    await rejectsWith(
      repo.applyStock({ type: 'transfer', productId: 'prd_house_12', fromLocationId: 'loc_bag', toLocationId: 'loc_pick', qty: 41, reason: '' }),
      'stock',
      /enough on-hand/,
    );
    await repo.applyStock({ type: 'transfer', productId: 'prd_house_12', fromLocationId: 'loc_bag', toLocationId: 'loc_pick', qty: 40, reason: 'Pick face' });
    const item = await repo.getItem('prd_house_12');
    expect(item.onHand).toBe(90);
    expect(item.byLocation.find((row) => row.locationId === 'loc_pick')?.qty).toBe(90);
    expect(item.byLocation.find((row) => row.locationId === 'loc_bag')?.qty).toBe(0);
  });

  it('receives a purchase order partially, then fully', async () => {
    const { repo } = setup();
    await repo.signInAsDemo('usr_nw_staff');
    const po = await repo.getPurchaseOrder('po_nw_1044');
    expect(po.status).toBe('partial');
    expect(po.lines.map((line) => line.remaining)).toEqual([300, 80]);
    expect(po.receivingLocations.map((loc) => loc.id).sort()).toEqual(['loc_pick', 'loc_ship']);

    await rejectsWith(
      repo.receivePurchaseOrder({ purchaseOrderId: po.id, locationId: 'loc_green', lines: [{ lineId: 'pol_bag_12', qty: 1 }] }),
      'stock',
      /warehouse/,
    );
    await rejectsWith(
      repo.receivePurchaseOrder({ purchaseOrderId: po.id, locationId: 'loc_pick', lines: [{ lineId: 'pol_bag_12', qty: 301 }] }),
      'stock',
      /Only 300 remain/,
    );

    const partial = await repo.receivePurchaseOrder({ purchaseOrderId: po.id, locationId: 'loc_pick', lines: [{ lineId: 'pol_bag_12', qty: 100 }] });
    expect(partial.order.status).toBe('partial');
    expect(partial.unitsReceived).toBe(100);

    const full = await repo.receivePurchaseOrder({
      purchaseOrderId: po.id,
      locationId: 'loc_ship',
      lines: [
        { lineId: 'pol_bag_12', qty: 200 },
        { lineId: 'pol_v60', qty: 80 },
      ],
    });
    expect(full.order.status).toBe('received');
    const bags = await repo.getItem('prd_bag_12');
    expect(bags.onHand).toBe(80 + 300);
    await rejectsWith(
      repo.receivePurchaseOrder({ purchaseOrderId: po.id, locationId: 'loc_pick', lines: [{ lineId: 'pol_v60', qty: 1 }] }),
      'invalid',
      /already fully received/,
    );
  });

  it('sends a draft and refuses to receive a draft', async () => {
    const { repo } = setup();
    await repo.signInAsDemo('usr_nw_owner');
    await rejectsWith(
      repo.receivePurchaseOrder({ purchaseOrderId: 'po_nw_1048', locationId: 'loc_pick', lines: [{ lineId: 'pol_oat', qty: 1 }] }),
      'invalid',
      /Send the purchase order/,
    );
    const sent = await repo.sendPurchaseOrder('po_nw_1048');
    expect(sent.status).toBe('sent');
    await rejectsWith(repo.sendPurchaseOrder('po_nw_1048'), 'invalid', /Only draft/);
  });

  it('lets a viewer read everything and change nothing', async () => {
    const { repo } = setup();
    const actor = await repo.signInAsDemo('usr_nw_viewer');
    expect(actor.role).toBe('viewer');
    expect((await repo.listItems()).length).toBe(26);
    await rejectsWith(
      repo.applyStock({ type: 'adjust', productId: 'prd_eth_12', locationId: 'loc_pick', delta: 1, reason: 'Count' }),
      'forbidden',
      /Viewers/,
    );
    const alerts = await repo.listAlerts();
    await rejectsWith(repo.markAlertRead(alerts[0].id), 'forbidden');
    await rejectsWith(repo.sendPurchaseOrder('po_nw_1048'), 'forbidden');
  });

  it('marks alerts read one at a time and all at once', async () => {
    const { repo } = setup();
    await repo.signInAsDemo('usr_nw_owner');
    const alerts = await repo.listAlerts();
    const unread = alerts.filter((alert) => !alert.read);
    expect(unread.length).toBeGreaterThan(1);
    await repo.markAlertRead(unread[0].id);
    expect((await repo.getDashboard()).unreadAlerts).toBe(unread.length - 1);
    expect(await repo.markAllAlertsRead()).toBe(unread.length - 1);
    expect((await repo.getDashboard()).unreadAlerts).toBe(0);
  });

  it('lets the super admin switch between both workspaces', async () => {
    const { repo } = setup();
    const actor = await repo.signInAsDemo('usr_admin');
    expect(actor.role).toBe('super_admin');
    const seats = await repo.listMemberships();
    expect(seats.map((seat) => seat.tenantName)).toEqual(['Harbor Auto Parts', 'Northwind Coffee Roasters']);
    const switched = await repo.switchWorkspace('tnt_harbor');
    expect(switched.activeTenantId).toBe('tnt_harbor');
    expect((await repo.getDashboard()).workspace.name).toBe('Harbor Auto Parts');
  });

  it('signs in once with a magic link and refuses to reuse it', async () => {
    const { repo } = setup();
    const unknown = await repo.requestMagicLink('stranger@example.com');
    expect(unknown.demoPath).toBeNull();
    const { demoPath } = await repo.requestMagicLink('owner@harbor.demo');
    const token = decodeURIComponent(demoPath!.split('token=')[1]);
    const actor = await repo.consumeMagicLink(token);
    expect(actor.name).toBe('Priya Shah');
    await repo.signOut();
    await rejectsWith(repo.consumeMagicLink(token), 'unauthenticated');
  });

  it('keeps changes and the session on the device, and resets the demo books', async () => {
    const { repo, persistence } = setup();
    await repo.signInAsDemo('usr_nw_staff');
    await repo.applyStock({ type: 'receive', productId: 'prd_mug', locationId: 'loc_pick', qty: 6, reason: 'Second kiln run' });

    const reopened = createMockRepository({ persistence, now: () => NOW });
    const actor = await reopened.restore();
    expect(actor?.name).toBe('Lena Ortiz');
    expect((await reopened.getItem('prd_mug')).onHand).toBe(24);

    await reopened.resetDemo();
    expect((await reopened.getItem('prd_mug')).onHand).toBe(18);
    expect((await reopened.currentActor())?.name).toBe('Lena Ortiz');
  });

  it('needs a session before any workspace read', async () => {
    const { repo } = setup();
    await rejectsWith(repo.getDashboard(), 'unauthenticated');
  });
});
