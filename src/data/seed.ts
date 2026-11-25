/**
 * The demo books: the same two workspaces, 42 SKUs, receipts, roast-loss adjustments,
 * transfers and purchase orders as the Shelfly web app's lib/seed.ts. Timestamps are laid
 * out relative to `now`, so "received 3 days ago" and "due in a week" stay true whenever
 * the demo is opened.
 */
import type { Unit } from '@/domain/model';
import {
  addPoLine,
  createProduct,
  emptyDatabase,
  postAdjust,
  postReceive,
  postTransfer,
  receivePurchaseOrder,
  sendPurchaseOrder,
  type EngineActor,
  type MockDatabase,
} from '@/data/engine';

export const DEMO_PASSWORD = 'shelfly-demo';

type ProductSeed = [id: string, sku: string, name: string, category: string, unit: Unit, costCents: number, reorder: number, barcode: string, description: string];

const northwindProducts: ProductSeed[] = [
  ['prd_eth_green', 'NW-GR-ETH', 'Ethiopia Yirgacheffe G1', 'Green coffee', 'lb', 680, 80, '840011000001', 'Washed lot 26-118, floral and tea-like. Stored in GrainPro.'],
  ['prd_col_green', 'NW-GR-COL', 'Colombia Huila Supremo', 'Green coffee', 'lb', 520, 60, '840011000002', 'Supremo screen 18, cocoa and red apple. Origin Imports contract.'],
  ['prd_bra_green', 'NW-GR-BRA', 'Brazil Cerrado Natural', 'Green coffee', 'lb', 410, 70, '840011000003', 'Natural process, nut and chocolate. Base of the house espresso.'],
  ['prd_gua_green', 'NW-GR-GUA', 'Guatemala Antigua SHB', 'Green coffee', 'lb', 590, 40, '840011000004', 'Strictly hard bean, brown sugar and orange peel.'],
  ['prd_sum_green', 'NW-GR-SUM', 'Sumatra Mandheling', 'Green coffee', 'lb', 540, 30, '840011000005', 'Wet-hulled, cedar and dark cocoa. Used in the winter espresso.'],
  ['prd_dec_green', 'NW-GR-DEC', 'Decaf Colombia EA', 'Green coffee', 'lb', 720, 25, '840011000006', 'Ethyl acetate decaf from Huila. Keep sealed.'],
  ['prd_house_bulk', 'NW-RO-HSE', 'House Espresso (bulk)', 'Roasted', 'lb', 980, 40, '840011000007', 'Brazil and Colombia blend, roasted for milk drinks.'],
  ['prd_filter_bulk', 'NW-RO-FLT', 'West Coast Filter (bulk)', 'Roasted', 'lb', 1120, 30, '840011000008', 'Washed Centrals, roasted light for batch brew.'],
  ['prd_eth_roast', 'NW-RO-ETH', 'Ethiopia Roasted (bulk)', 'Roasted', 'lb', 1460, 20, '840011000009', 'Yirgacheffe lot 26-118 off the roaster.'],
  ['prd_dec_roast', 'NW-RO-DEC', 'Decaf House (bulk)', 'Roasted', 'lb', 1240, 15, '840011000010', 'Decaf espresso component, roasted on Thursdays.'],
  ['prd_house_12', 'NW-RT-HSE', 'House Espresso 12oz', 'Retail', 'bag', 1480, 48, '840011000011', 'Valve bag, roasted date printed on the tin tie.'],
  ['prd_eth_12', 'NW-RT-ETH', 'Ethiopia 12oz', 'Retail', 'bag', 1680, 36, '840011000012', 'Single-origin retail bag for the subscription.'],
  ['prd_col_12', 'NW-RT-COL', 'Colombia 12oz', 'Retail', 'bag', 1560, 36, '840011000013', 'Huila retail bag, grocery and cafe wholesale.'],
  ['prd_dec_12', 'NW-RT-DEC', 'Decaf 12oz', 'Retail', 'bag', 1620, 24, '840011000014', 'Decaf retail bag. Do not mix with flavored syrup stock.'],
  ['prd_cold', 'NW-RT-CB', 'Cold Brew 32oz', 'Retail', 'each', 890, 18, '840011000015', 'Concentrate, kegged then bottled. Keep refrigerated.'],
  ['prd_instant', 'NW-RT-INS', 'Instant 8oz', 'Retail', 'each', 1240, 20, '840011000016', 'Microground instant from the house espresso.'],
  ['prd_bag_12', 'NW-PK-12', '12oz Kraft Bags', 'Packaging', 'each', 42, 200, '840011000017', 'Matte kraft with degassing valve. PacCoast item K12.'],
  ['prd_bag_2', 'NW-PK-2LB', '2lb Wholesale Bags', 'Packaging', 'each', 68, 80, '840011000018', 'Unprinted 2lb bags for cafe wholesale.'],
  ['prd_v60', 'NW-SP-V60', 'V60 Paper Filters', 'Supplies', 'each', 18, 40, '840011000019', 'White 02 filters for the training bar and retail.'],
  ['prd_cup', 'NW-SP-CUP', '12oz Hot Cups', 'Supplies', 'each', 14, 150, '840011000020', 'Double-wall cups for the Oakland cafe.'],
  ['prd_lid', 'NW-SP-LID', 'Cup Lids', 'Supplies', 'each', 8, 150, '840011000021', 'Sip lids matched to the 12oz cup.'],
  ['prd_oat', 'NW-SP-OAT', 'Oat Milk Barista (case)', 'Cafe', 'case', 3840, 8, '840011000022', '6 × 32oz. Refrigerate. CafeSupply standing order.'],
  ['prd_milk', 'NW-SP-MLK', 'Whole Milk (case)', 'Cafe', 'case', 3120, 6, '840011000023', 'Local dairy, 9 half-gallons. Two-day shelf.'],
  ['prd_syrup', 'NW-SP-VAN', 'Vanilla Syrup', 'Cafe', 'each', 980, 6, '840011000024', '750ml vanilla for the house latte.'],
  ['prd_cleaner', 'NW-SP-CLN', 'Espresso Machine Cleaner', 'Supplies', 'each', 1640, 4, '840011000025', 'Backflush powder. Keep off the green coffee floor.'],
  ['prd_mug', 'NW-RT-MUG', 'Diner Mug 10oz', 'Retail', 'each', 890, 12, '840011000026', 'Speckled diner mug, Northwind stamp on the foot.'],
];

const harborProducts: ProductSeed[] = [
  ['prd_pad_civic', 'HB-BR-CIV', 'Ceramic Pads — Civic', 'Brakes', 'each', 4295, 12, '840022000001', 'Front ceramic set, Honda Civic 2016–2021.'],
  ['prd_pad_f150', 'HB-BR-F15', 'Ceramic Pads — F-150', 'Brakes', 'each', 5890, 8, '840022000002', 'Front ceramic set, F-150 2015–2020.'],
  ['prd_rot_civic', 'HB-RT-CIV', 'Front Rotors — Civic', 'Brakes', 'each', 6490, 6, '840022000003', 'Vented front rotor, Civic, sold each.'],
  ['prd_rot_f150', 'HB-RT-F15', 'Front Rotors — F-150', 'Brakes', 'each', 8990, 4, '840022000004', 'Vented front rotor, F-150, sold each.'],
  ['prd_of_ph', 'HB-FL-PH', 'Oil Filter PH3614', 'Filters', 'each', 890, 20, '840022000005', "Spin-on filter, the counter's fastest mover."],
  ['prd_of_toy', 'HB-FL-TOY', 'Oil Filter — Toyota', 'Filters', 'each', 1120, 16, '840022000006', 'Cartridge filter for common Toyota 4-cylinders.'],
  ['prd_cab_civic', 'HB-FL-CAB', 'Cabin Filter — Civic', 'Filters', 'each', 1640, 8, '840022000007', 'Particulate cabin filter, Civic 2016–2021.'],
  ['prd_air_civic', 'HB-FL-AIR', 'Engine Air Filter — Civic', 'Filters', 'each', 1890, 10, '840022000008', 'Panel air filter, Civic 2016–2021.'],
  ['prd_oil_530', 'HB-OL-530', '5W-30 Synthetic (qt)', 'Oil', 'qt', 740, 24, '840022000009', 'Full synthetic quart. Case-break is allowed.'],
  ['prd_oil_020', 'HB-OL-020', '0W-20 Synthetic (qt)', 'Oil', 'qt', 790, 8, '840022000010', 'Full synthetic quart for newer Toyota and Honda.'],
  ['prd_wiper_22', 'HB-WP-22', 'Wiper Blade 22in', 'Wipers', 'each', 1490, 10, '840022000011', 'Beam blade, 22 inch.'],
  ['prd_wiper_18', 'HB-WP-18', 'Wiper Blade 18in', 'Wipers', 'each', 1390, 10, '840022000012', 'Beam blade, 18 inch. Pairs with the 22.'],
  ['prd_belt', 'HB-EN-BLT', 'Serpentine Belt 6PK2135', 'Engine', 'each', 2840, 6, '840022000013', '6-rib belt, common GM and Ford applications.'],
  ['prd_plug', 'HB-EN-PLG', 'Iridium Spark Plug', 'Engine', 'each', 980, 24, '840022000014', 'Iridium plug, sold each. Check gap before the counter.'],
  ['prd_batt', 'HB-EL-35', 'AGM Battery Group 35', 'Electrical', 'each', 18900, 4, '840022000015', 'Group 35 AGM. Core charge is tracked at the register, not here.'],
  ['prd_clean', 'HB-CH-BRK', 'Brake Cleaner', 'Chemicals', 'each', 490, 12, '840022000016', 'Non-chlorinated aerosol. Flammable storage.'],
];

const ownerNw: EngineActor = { userId: 'usr_nw_owner', role: 'owner' };
const staffNw: EngineActor = { userId: 'usr_nw_staff', role: 'warehouse_staff' };
const ownerHb: EngineActor = { userId: 'usr_hb_owner', role: 'owner' };
const staffHb: EngineActor = { userId: 'usr_hb_staff', role: 'warehouse_staff' };

export function createDemoDatabase(now: Date = new Date()): MockDatabase {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = (daysAgo: number, hour = 15) => new Date(midnight - daysAgo * 86_400_000 + hour * 3_600_000 + 5 * 60_000).toISOString();
  const date = (daysAhead: number) => new Date(midnight + daysAhead * 86_400_000).toISOString().slice(0, 10);

  const db = emptyDatabase();
  db.tenants.push(
    { id: 'tnt_northwind', name: 'Northwind Coffee Roasters', slug: 'northwind', industry: 'Coffee roasting', plan: 'pro', createdAt: day(400) },
    { id: 'tnt_harbor', name: 'Harbor Auto Parts', slug: 'harbor', industry: 'Auto parts', plan: 'starter', createdAt: day(260) },
  );
  db.users.push(
    { id: 'usr_nw_owner', email: 'owner@northwind.demo', name: 'Mustafa Hale', title: 'Owner', isSuperAdmin: false, password: DEMO_PASSWORD },
    { id: 'usr_nw_staff', email: 'floor@northwind.demo', name: 'Lena Ortiz', title: 'Head roaster', isSuperAdmin: false, password: DEMO_PASSWORD },
    { id: 'usr_nw_viewer', email: 'audit@northwind.demo', name: 'Jonah Peck', title: 'Finance', isSuperAdmin: false, password: DEMO_PASSWORD },
    { id: 'usr_hb_owner', email: 'owner@harbor.demo', name: 'Priya Shah', title: 'Owner', isSuperAdmin: false, password: DEMO_PASSWORD },
    { id: 'usr_hb_staff', email: 'floor@harbor.demo', name: 'Chris Lang', title: 'Counter lead', isSuperAdmin: false, password: DEMO_PASSWORD },
    { id: 'usr_admin', email: 'admin@shelfly.demo', name: 'Avery Quinn', title: 'Shelfly super admin', isSuperAdmin: true, password: DEMO_PASSWORD },
  );
  db.memberships.push(
    { id: 'mem_nw_owner', tenantId: 'tnt_northwind', userId: 'usr_nw_owner', role: 'owner' },
    { id: 'mem_nw_staff', tenantId: 'tnt_northwind', userId: 'usr_nw_staff', role: 'warehouse_staff' },
    { id: 'mem_nw_viewer', tenantId: 'tnt_northwind', userId: 'usr_nw_viewer', role: 'viewer' },
    { id: 'mem_hb_owner', tenantId: 'tnt_harbor', userId: 'usr_hb_owner', role: 'owner' },
    { id: 'mem_hb_staff', tenantId: 'tnt_harbor', userId: 'usr_hb_staff', role: 'warehouse_staff' },
  );
  db.warehouses.push(
    { id: 'wh_oak_roast', tenantId: 'tnt_northwind', name: 'Oakland Roastery', code: 'OAK-R', address: '1847 Mandela Parkway', city: 'Oakland, CA' },
    { id: 'wh_oak_ful', tenantId: 'tnt_northwind', name: 'West Coast Fulfillment', code: 'OAK-F', address: '900 77th Avenue', city: 'Oakland, CA' },
    { id: 'wh_detroit', tenantId: 'tnt_harbor', name: 'Detroit Metro DC', code: 'DET-1', address: '4100 W Fort Street', city: 'Detroit, MI' },
  );
  db.locations.push(
    { id: 'loc_green', tenantId: 'tnt_northwind', warehouseId: 'wh_oak_roast', name: 'Green Receiving', code: 'GRN' },
    { id: 'loc_roast', tenantId: 'tnt_northwind', warehouseId: 'wh_oak_roast', name: 'Roast Floor', code: 'RST' },
    { id: 'loc_bag', tenantId: 'tnt_northwind', warehouseId: 'wh_oak_roast', name: 'Bagging', code: 'BAG' },
    { id: 'loc_pick', tenantId: 'tnt_northwind', warehouseId: 'wh_oak_ful', name: 'Pick Aisle', code: 'PICK' },
    { id: 'loc_ship', tenantId: 'tnt_northwind', warehouseId: 'wh_oak_ful', name: 'Ship Staging', code: 'SHIP' },
    { id: 'loc_fast', tenantId: 'tnt_harbor', warehouseId: 'wh_detroit', name: 'Fast Lane', code: 'FAST' },
    { id: 'loc_bulk', tenantId: 'tnt_harbor', warehouseId: 'wh_detroit', name: 'Bulk Racking', code: 'BULK' },
    { id: 'loc_returns', tenantId: 'tnt_harbor', warehouseId: 'wh_detroit', name: 'Returns Cage', code: 'RTN' },
  );
  db.suppliers.push(
    { id: 'sup_origin', tenantId: 'tnt_northwind', name: 'Origin Imports', email: 'green@originimports.example', phone: '(510) 555-0142', address: 'Pier 23, Oakland, CA', notes: 'Green coffee. Lead time 5 weeks on new lots.' },
    { id: 'sup_paccoast', tenantId: 'tnt_northwind', name: 'PacCoast Packaging', email: 'hello@paccoast.example', phone: '(415) 555-0177', address: 'South San Francisco, CA', notes: 'Bags, filters, and cups. Partial shipments are normal.' },
    { id: 'sup_cafe', tenantId: 'tnt_northwind', name: 'CafeSupply Co', email: 'orders@cafesupply.example', phone: '(510) 555-0190', address: 'Emeryville, CA', notes: 'Dairy alternatives and syrups. Refrigerated.' },
    { id: 'sup_friction', tenantId: 'tnt_harbor', name: 'Midwest Friction', email: 'sales@midwestfriction.example', phone: '(313) 555-0114', address: 'Livonia, MI', notes: 'Pads and rotors. Core is not tracked in Shelfly.' },
    { id: 'sup_petro', tenantId: 'tnt_harbor', name: 'PetroLube Distribution', email: 'desk@petrolube.example', phone: '(313) 555-0166', address: 'Dearborn, MI', notes: 'Oil by the quart. They short-ship quarts often.' },
    { id: 'sup_filter', tenantId: 'tnt_harbor', name: 'FilterHaus', email: 'orders@filterhaus.example', phone: '(248) 555-0133', address: 'Troy, MI', notes: 'Filters and wipers.' },
  );

  const place = (tenantId: string, rows: ProductSeed[], at: string) => {
    for (const [id, sku, name, category, unit, costCents, reorderPoint, barcode, description] of rows) {
      createProduct(db, { id, tenantId, sku, name, category, unit, costCents, reorderPoint, barcode, description, at });
    }
  };
  place('tnt_northwind', northwindProducts, day(120));
  place('tnt_harbor', harborProducts, day(90));

  const simple: [string, string, number, number, string, EngineActor][] = [
    ['prd_col_green', 'loc_green', 110, 40, 'Origin Imports delivery, BOL 44102', staffNw],
    ['prd_bra_green', 'loc_green', 95, 38, 'Origin Imports delivery, BOL 44102', staffNw],
    ['prd_gua_green', 'loc_green', 48, 36, 'Origin Imports delivery, Antigua container', staffNw],
    ['prd_sum_green', 'loc_green', 36, 34, 'Origin Imports delivery, wet-hulled lot', staffNw],
    ['prd_dec_green', 'loc_green', 28, 33, 'Decaf lot checked in at green receiving', staffNw],
    ['prd_filter_bulk', 'loc_roast', 55, 12, 'West Coast filter off the Probat', staffNw],
    ['prd_dec_roast', 'loc_roast', 22, 11, 'Thursday decaf roast', staffNw],
    ['prd_eth_12', 'loc_pick', 60, 9, 'Bagged Ethiopia for the subscription', staffNw],
    ['prd_col_12', 'loc_pick', 44, 9, 'Bagged Colombia for grocery wholesale', staffNw],
    ['prd_dec_12', 'loc_pick', 30, 9, 'Bagged decaf retail', staffNw],
    ['prd_cold', 'loc_pick', 26, 7, 'Bottled cold brew concentrate', staffNw],
    ['prd_instant', 'loc_pick', 28, 8, 'Instant tins from the co-packer', staffNw],
    ['prd_bag_2', 'loc_bag', 120, 21, 'PacCoast 2lb bags, packing slip 883', staffNw],
    ['prd_cup', 'loc_ship', 240, 15, 'Cup delivery staged for the cafe', staffNw],
    ['prd_lid', 'loc_ship', 260, 15, 'Lids matched to the cup delivery', staffNw],
    ['prd_milk', 'loc_ship', 9, 2, 'Dairy drop, use by Friday', staffNw],
    ['prd_syrup', 'loc_pick', 8, 18, 'Vanilla syrup, CafeSupply', staffNw],
    ['prd_cleaner', 'loc_roast', 6, 22, 'Backflush powder for the roastery', staffNw],
    ['prd_mug', 'loc_pick', 18, 16, 'Diner mugs from the ceramic run', staffNw],
    ['prd_pad_f150', 'loc_fast', 14, 20, 'Midwest Friction, F-150 pad sets', staffHb],
    ['prd_rot_civic', 'loc_bulk', 8, 19, 'Civic rotors put into bulk racking', staffHb],
    ['prd_rot_f150', 'loc_bulk', 5, 19, 'F-150 rotors put into bulk racking', staffHb],
    ['prd_of_ph', 'loc_fast', 28, 6, 'FilterHaus, PH3614 case break', staffHb],
    ['prd_of_toy', 'loc_fast', 22, 6, 'FilterHaus, Toyota cartridges', staffHb],
    ['prd_air_civic', 'loc_fast', 14, 6, 'FilterHaus, Civic engine air filters', staffHb],
    ['prd_wiper_22', 'loc_fast', 16, 13, 'Wiper delivery, 22 inch beam blades', staffHb],
    ['prd_wiper_18', 'loc_fast', 15, 13, 'Wiper delivery, 18 inch beam blades', staffHb],
    ['prd_belt', 'loc_bulk', 9, 17, '6PK2135 belts, bulk racking', staffHb],
    ['prd_plug', 'loc_fast', 40, 10, 'Iridium plugs, counter bin', staffHb],
    ['prd_batt', 'loc_bulk', 6, 14, 'Group 35 AGM, keep upright', staffHb],
    ['prd_clean', 'loc_fast', 18, 5, 'Brake cleaner, flammable cage counted into fast lane', staffHb],
  ];
  for (const [productId, locationId, qty, daysAgo, reason, actor] of simple) {
    const tenantId = actor === staffHb ? 'tnt_harbor' : 'tnt_northwind';
    postReceive(db, actor, { tenantId, productId, locationId, qty, reason, at: day(daysAgo) });
  }

  const nw = 'tnt_northwind';
  const hb = 'tnt_harbor';
  postReceive(db, staffNw, { tenantId: nw, productId: 'prd_eth_green', locationId: 'loc_green', qty: 180, reason: 'Origin Imports, Yirgacheffe lot 26-118, BOL 44192', at: day(28) });
  postAdjust(db, staffNw, { tenantId: nw, productId: 'prd_eth_green', locationId: 'loc_green', delta: -40, reason: 'Roasted into Ethiopia bulk, lot 26-118, 14% shrink on the Probat', at: day(8) });
  postReceive(db, staffNw, { tenantId: nw, productId: 'prd_eth_roast', locationId: 'loc_roast', qty: 34, reason: 'Off the roaster, Yirgacheffe lot 26-118', at: day(8, 18) });
  postReceive(db, staffNw, { tenantId: nw, productId: 'prd_house_bulk', locationId: 'loc_roast', qty: 80, reason: 'House espresso off the roaster', at: day(6) });
  postTransfer(db, staffNw, { tenantId: nw, productId: 'prd_house_bulk', fromLocationId: 'loc_roast', toLocationId: 'loc_bag', qty: 16, reason: 'Moved to bagging for the Friday retail run', at: day(4) });
  postReceive(db, staffNw, { tenantId: nw, productId: 'prd_house_12', locationId: 'loc_bag', qty: 90, reason: 'Bagged house espresso, valve bags', at: day(3) });
  postTransfer(db, staffNw, { tenantId: nw, productId: 'prd_house_12', fromLocationId: 'loc_bag', toLocationId: 'loc_pick', qty: 50, reason: 'Replenish the fulfillment pick face', at: day(1) });
  postReceive(db, staffNw, { tenantId: nw, productId: 'prd_oat', locationId: 'loc_pick', qty: 10, reason: 'CafeSupply standing order', at: day(9) });
  postAdjust(db, staffNw, { tenantId: nw, productId: 'prd_oat', locationId: 'loc_pick', delta: -7, reason: 'Par-level pull for the Oakland cafe bar', at: day(1, 11) });
  postReceive(db, staffHb, { tenantId: hb, productId: 'prd_pad_civic', locationId: 'loc_fast', qty: 16, reason: 'Midwest Friction delivery, BOL 2291', at: day(18) });
  postAdjust(db, staffHb, { tenantId: hb, productId: 'prd_pad_civic', locationId: 'loc_fast', delta: -12, reason: 'Counter sales, weeks 45 through 47', at: day(2) });
  postReceive(db, staffHb, { tenantId: hb, productId: 'prd_cab_civic', locationId: 'loc_fast', qty: 8, reason: 'FilterHaus cabin filters', at: day(11) });
  postAdjust(db, staffHb, { tenantId: hb, productId: 'prd_cab_civic', locationId: 'loc_fast', delta: -6, reason: 'Installed on counter jobs, work orders 441–446', at: day(2, 12) });

  // NW-1044: PacCoast packaging, sent and partly received. They ship partials.
  db.purchaseOrders.push({ id: 'po_nw_1044', tenantId: nw, number: 'NW-1044', supplierId: 'sup_paccoast', warehouseId: 'wh_oak_ful', status: 'draft', notes: 'Kraft bags and V60 filters. They ship partials.', expectedOn: date(-5), createdAt: day(18), updatedAt: day(18) });
  addPoLine(db, { id: 'pol_bag_12', tenantId: nw, purchaseOrderId: 'po_nw_1044', productId: 'prd_bag_12', qtyOrdered: 500, unitCostCents: 42 });
  addPoLine(db, { id: 'pol_v60', tenantId: nw, purchaseOrderId: 'po_nw_1044', productId: 'prd_v60', qtyOrdered: 120, unitCostCents: 18 });
  sendPurchaseOrder(db, ownerNw, { tenantId: nw, purchaseOrderId: 'po_nw_1044', at: day(17) });
  receivePurchaseOrder(db, staffNw, { tenantId: nw, purchaseOrderId: 'po_nw_1044', locationId: 'loc_pick', lines: [{ lineId: 'pol_bag_12', qty: 200 }, { lineId: 'pol_v60', qty: 40 }], at: day(16) });
  postAdjust(db, staffNw, { tenantId: nw, productId: 'prd_bag_12', locationId: 'loc_pick', delta: -120, reason: 'Packed the week 46 subscription roast', at: day(5) });
  postAdjust(db, staffNw, { tenantId: nw, productId: 'prd_v60', locationId: 'loc_pick', delta: -28, reason: 'Bar restock for the Oakland cafe, week 47', at: day(2, 9) });

  // HB-218: quart oil, PetroLube shorted the first shipment.
  db.purchaseOrders.push({ id: 'po_hb_218', tenantId: hb, number: 'HB-218', supplierId: 'sup_petro', warehouseId: 'wh_detroit', status: 'draft', notes: 'Quart oil. PetroLube often shorts the first shipment.', expectedOn: date(-7), createdAt: day(15), updatedAt: day(15) });
  addPoLine(db, { id: 'pol_oil_530', tenantId: hb, purchaseOrderId: 'po_hb_218', productId: 'prd_oil_530', qtyOrdered: 48, unitCostCents: 740 });
  addPoLine(db, { id: 'pol_oil_020', tenantId: hb, purchaseOrderId: 'po_hb_218', productId: 'prd_oil_020', qtyOrdered: 36, unitCostCents: 790 });
  sendPurchaseOrder(db, ownerHb, { tenantId: hb, purchaseOrderId: 'po_hb_218', at: day(14, 9) });
  receivePurchaseOrder(db, staffHb, { tenantId: hb, purchaseOrderId: 'po_hb_218', locationId: 'loc_bulk', lines: [{ lineId: 'pol_oil_530', qty: 24 }, { lineId: 'pol_oil_020', qty: 12 }], at: day(14) });
  postTransfer(db, staffHb, { tenantId: hb, productId: 'prd_oil_530', fromLocationId: 'loc_bulk', toLocationId: 'loc_fast', qty: 8, reason: 'Move quarts up to the fast lane', at: day(7) });
  postAdjust(db, staffHb, { tenantId: hb, productId: 'prd_oil_530', locationId: 'loc_bulk', delta: -10, reason: 'Wholesale delivery, invoice 8841', at: day(4, 10) });

  // NW-1041: green coffee, sent, nothing received yet.
  db.purchaseOrders.push({ id: 'po_nw_1041', tenantId: nw, number: 'NW-1041', supplierId: 'sup_origin', warehouseId: 'wh_oak_roast', status: 'draft', notes: 'Replenish the washed lots before the December subscription.', expectedOn: date(7), createdAt: day(3), updatedAt: day(3) });
  addPoLine(db, { id: 'pol_eth', tenantId: nw, purchaseOrderId: 'po_nw_1041', productId: 'prd_eth_green', qtyOrdered: 200, unitCostCents: 640 });
  addPoLine(db, { id: 'pol_col', tenantId: nw, purchaseOrderId: 'po_nw_1041', productId: 'prd_col_green', qtyOrdered: 150, unitCostCents: 490 });
  addPoLine(db, { id: 'pol_bra', tenantId: nw, purchaseOrderId: 'po_nw_1041', productId: 'prd_bra_green', qtyOrdered: 100, unitCostCents: 390 });
  sendPurchaseOrder(db, ownerNw, { tenantId: nw, purchaseOrderId: 'po_nw_1041', at: day(3, 11) });

  // NW-1048: a draft nobody has sent.
  db.purchaseOrders.push({ id: 'po_nw_1048', tenantId: nw, number: 'NW-1048', supplierId: 'sup_cafe', warehouseId: 'wh_oak_ful', status: 'draft', notes: 'Draft for oat milk and syrup. Not sent.', expectedOn: null, createdAt: day(1, 8), updatedAt: day(1, 8) });
  addPoLine(db, { id: 'pol_oat', tenantId: nw, purchaseOrderId: 'po_nw_1048', productId: 'prd_oat', qtyOrdered: 6, unitCostCents: 3840 });
  addPoLine(db, { id: 'pol_syrup', tenantId: nw, purchaseOrderId: 'po_nw_1048', productId: 'prd_syrup', qtyOrdered: 4, unitCostCents: 980 });

  // HB-220: Civic pads, sent and waiting.
  db.purchaseOrders.push({ id: 'po_hb_220', tenantId: hb, number: 'HB-220', supplierId: 'sup_friction', warehouseId: 'wh_detroit', status: 'draft', notes: 'Restock Civic pads before the weekend rush.', expectedOn: date(9), createdAt: day(4), updatedAt: day(4) });
  addPoLine(db, { id: 'pol_pad_civic', tenantId: hb, purchaseOrderId: 'po_hb_220', productId: 'prd_pad_civic', qtyOrdered: 24, unitCostCents: 3890 });
  addPoLine(db, { id: 'pol_pad_f150', tenantId: hb, purchaseOrderId: 'po_hb_220', productId: 'prd_pad_f150', qtyOrdered: 10, unitCostCents: 5400 });
  sendPurchaseOrder(db, ownerHb, { tenantId: hb, purchaseOrderId: 'po_hb_220', at: day(4, 16) });

  return db;
}
