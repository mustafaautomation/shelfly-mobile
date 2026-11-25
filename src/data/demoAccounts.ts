import { DEMO_PASSWORD } from '@/data/seed';

export interface DemoAccount {
  userId: string;
  name: string;
  email: string;
  password: string;
  workspace: string;
  roleLabel: string;
  detail: string;
  tone: 'forest' | 'copper' | 'slate' | 'steel';
}

/** The seats in the demo books. They exist only in mock mode, on this device. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    userId: 'usr_nw_staff',
    name: 'Lena Ortiz',
    email: 'floor@northwind.demo',
    password: DEMO_PASSWORD,
    workspace: 'Northwind Coffee Roasters',
    roleLabel: 'Warehouse staff',
    detail: 'Scan a bag, post a roast-loss adjustment, and finish the PacCoast partial delivery.',
    tone: 'copper',
  },
  {
    userId: 'usr_nw_owner',
    name: 'Mustafa Hale',
    email: 'owner@northwind.demo',
    password: DEMO_PASSWORD,
    workspace: 'Northwind Coffee Roasters',
    roleLabel: 'Owner',
    detail: 'Stock by location across the roastery and fulfillment, low-stock alerts, and the CafeSupply draft to send.',
    tone: 'forest',
  },
  {
    userId: 'usr_nw_viewer',
    name: 'Jonah Peck',
    email: 'audit@northwind.demo',
    password: DEMO_PASSWORD,
    workspace: 'Northwind Coffee Roasters',
    roleLabel: 'Viewer',
    detail: 'Finance seat. Reads every shelf and order, and every stock button says why it is locked.',
    tone: 'slate',
  },
  {
    userId: 'usr_hb_staff',
    name: 'Chris Lang',
    email: 'floor@harbor.demo',
    password: DEMO_PASSWORD,
    workspace: 'Harbor Auto Parts',
    roleLabel: 'Warehouse staff',
    detail: 'Counter lead in Detroit. PetroLube shorted the quart oil, so HB-218 is waiting on the rest.',
    tone: 'steel',
  },
  {
    userId: 'usr_hb_owner',
    name: 'Priya Shah',
    email: 'owner@harbor.demo',
    password: DEMO_PASSWORD,
    workspace: 'Harbor Auto Parts',
    roleLabel: 'Owner',
    detail: 'One DC, three locations, Civic pads below reorder point. Cannot see a single Northwind SKU.',
    tone: 'steel',
  },
  {
    userId: 'usr_admin',
    name: 'Avery Quinn',
    email: 'admin@shelfly.demo',
    password: DEMO_PASSWORD,
    workspace: 'Both workspaces',
    roleLabel: 'Super admin',
    detail: 'Shelfly support. Switches between Northwind and Harbor from More.',
    tone: 'forest',
  },
];
