// Refreshes docs/screenshots from the web export. Run `npm run build:web` first.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const port = 4427;
const base = `http://127.0.0.1:${port}`;
const out = path.resolve('docs/screenshots');
const server = spawn('npx', ['serve', '-s', 'dist', '-l', String(port), '--no-port-switching'], { stdio: 'ignore' });

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      // serve is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('The web preview did not start.');
}

async function enter(page, userId) {
  await page.goto(base);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await page.getByTestId(`demo-${userId}`).click();
  await page.getByTestId('home').getByText('Needs restock').waitFor();
}

try {
  await mkdir(out, { recursive: true });
  await waitForServer();
  const browser = await chromium.launch();
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
  const shot = (page, name) => page.screenshot({ path: path.join(out, name) });

  const page = await browser.newPage(phone);
  await page.goto(base);
  await page.getByRole('button', { name: 'Try the demo' }).waitFor();
  await shot(page, 'welcome.png');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await page.getByText('Pick a seat').waitFor();
  await shot(page, 'demo.png');
  await page.getByTestId('demo-usr_nw_staff').click();
  await page.getByTestId('home').getByText('Needs restock').waitFor();
  await shot(page, 'home.png');

  await page.getByRole('tab', { name: 'Scan' }).click();
  await page.getByTestId('scan').getByTestId('code-input').fill('840011000012');
  await page.getByTestId('scan').getByRole('button', { name: 'Look up' }).click();
  await page.getByTestId('scan-result').waitFor();
  await page.getByTestId('scan-result').scrollIntoViewIfNeeded();
  await shot(page, 'scan.png');

  await page.getByTestId('scan-result').getByRole('button', { name: 'Adjust', exact: true }).click();
  await page.getByTestId('stock').getByRole('radio', { name: 'Damaged' }).click();
  await shot(page, 'adjust.png');

  await page.goto(`${base}/item/prd_bag_12`);
  await page.getByTestId('on-hand').waitFor();
  await shot(page, 'item.png');

  await page.goto(`${base}/receive/po_nw_1044`);
  await page.getByTestId('receive').getByRole('button', { name: 'Scan 12oz Kraft Bags' }).click();
  await page.getByTestId('receive').getByRole('button', { name: 'Scan V60 Paper Filters' }).click();
  await shot(page, 'receive.png');

  const owner = await browser.newContext({ ...phone, colorScheme: 'dark' });
  const ownerPage = await owner.newPage();
  await enter(ownerPage, 'usr_nw_owner');
  await ownerPage.getByRole('tab', { name: 'Locations' }).click();
  await ownerPage.getByTestId('locations').getByText('Oakland Roastery').waitFor();
  await shot(ownerPage, 'locations-dark.png');
  await ownerPage.getByRole('tab', { name: /Alerts/ }).click();
  await ownerPage.getByTestId('alerts').getByText('Mark all 3 read').waitFor();
  await shot(ownerPage, 'alerts-dark.png');

  const wide = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await enter(wide, 'usr_nw_staff');
  await shot(wide, 'tablet.png');

  await browser.close();
  console.log(`screenshots written to ${out}`);
} finally {
  server.kill('SIGTERM');
}
