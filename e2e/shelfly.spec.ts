import { expect, test, type Page } from '@playwright/test';

async function enterDemo(page: Page, seat: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await page.getByRole('button', { name: new RegExp(seat) }).click();
  await expect(page.getByTestId('home').getByText('Needs restock')).toBeVisible();
}

test('floor staff scan a barcode and post an adjustment with a reason', async ({ page }) => {
  await enterDemo(page, 'Lena Ortiz');
  await page.getByRole('tab', { name: 'Scan' }).click();
  const scan = page.getByTestId('scan');
  // EAN-13 with a leading zero still finds the 12-digit UPC on the label.
  await scan.getByTestId('code-input').fill('0840011000012');
  await scan.getByRole('button', { name: 'Look up' }).click();
  const result = page.getByTestId('scan-result');
  await expect(result.getByText('Ethiopia 12oz')).toBeVisible();
  await expect(result.getByText('60', { exact: true })).toBeVisible();

  await result.getByRole('button', { name: 'Adjust', exact: true }).click();
  const form = page.getByTestId('stock');
  await expect(form.getByText('Pick Aisle: 60 → 59 bag')).toBeVisible();
  await page.getByTestId('submit-stock').click();
  await expect(page.getByText('Every adjustment needs a reason on the ledger.')).toBeVisible();

  await form.getByRole('radio', { name: 'Damaged' }).click();
  await form.getByRole('button', { name: 'Increase Quantity' }).click();
  await page.getByTestId('submit-stock').click();
  const done = page.getByTestId('stock-done');
  await expect(done.getByText('Posted')).toBeVisible();
  await expect(done.getByText('58 bag')).toBeVisible();

  await done.getByRole('button', { name: 'Back to item' }).click();
  const item = page.getByTestId('item');
  await expect(item.getByTestId('on-hand')).toContainText('58');
  await expect(item.getByText('Damaged').first()).toBeVisible();
});

test('staff receive a purchase order by scanning, first partly and then in full', async ({ page }) => {
  await enterDemo(page, 'Lena Ortiz');
  await page.getByRole('tab', { name: 'Orders' }).click();
  await page.getByTestId('orders').getByRole('button', { name: /NW-1044, PacCoast Packaging, Partial/ }).click();
  await expect(page.getByTestId('po').getByText('240 of 620 units received', { exact: false })).toBeVisible();
  await page.getByTestId('receive-po').click();

  const receive = page.getByTestId('receive');
  await receive.getByRole('button', { name: 'Scan 12oz Kraft Bags' }).click();
  await receive.getByRole('button', { name: 'Scan 12oz Kraft Bags' }).click();
  await expect(receive.getByText('Counted 1 × 12oz Kraft Bags (2 of 300)')).toBeVisible();
  await receive.getByTestId('code-input').fill('999999999999');
  await receive.getByRole('button', { name: 'Count' }).click();
  await expect(receive.getByText('999999999999 is not on NW-1044. Set that carton aside.')).toBeVisible();
  await page.getByTestId('post-receipt').click();

  const done = page.getByTestId('receive-done');
  await expect(done.getByText('Partial receipt posted')).toBeVisible();
  await expect(done.getByText(/2 units are on the shelf at Pick Aisle/)).toBeVisible();
  await done.getByRole('button', { name: 'Back to the order' }).click();

  const po = page.getByTestId('po');
  await expect(po.getByText('202/500')).toBeVisible();
  await po.getByTestId('receive-po').click();
  await page.getByTestId('receive').getByRole('button', { name: 'Fill all remaining' }).click();
  await expect(page.getByText('order will be received in full', { exact: false })).toBeVisible();
  await page.getByTestId('post-receipt').click();
  await expect(page.getByTestId('receive-done').getByText('Order complete')).toBeVisible();
  await page.getByTestId('receive-done').getByRole('button', { name: 'Back to the order' }).click();
  await expect(page.getByTestId('po').getByText('Every line on this order is on the shelf.')).toBeVisible();
});

test('staff transfer stock between locations and the source cannot be overdrawn', async ({ page }) => {
  await enterDemo(page, 'Lena Ortiz');
  await page.getByRole('tab', { name: 'Items' }).click();
  await page.getByTestId('item-search').fill('house espresso 12');
  await page.getByTestId('item-prd_house_12').click();
  await page.getByTestId('item').getByRole('button', { name: 'Transfer', exact: true }).click();

  const form = page.getByTestId('stock');
  await form.getByRole('radio', { name: 'From Bagging' }).click();
  await form.getByRole('radio', { name: 'To Pick Aisle' }).click();
  // The stepper stops at what the source shelf holds.
  await form.getByTestId('qty').fill('99');
  await expect(form.getByTestId('qty')).toHaveValue('40');
  await expect(form.getByText('Bagging 40 → 0, Pick Aisle 50 → 90')).toBeVisible();
  await page.getByTestId('submit-stock').click();
  await expect(page.getByTestId('stock-done').getByText('Moved 40 bag from Bagging to Pick Aisle.')).toBeVisible();
  await page.getByTestId('stock-done').getByRole('button', { name: 'Back to item' }).click();

  const item = page.getByTestId('item');
  await expect(item.getByRole('button', { name: 'Pick Aisle, 90 bag' })).toBeVisible();
  await expect(item.getByRole('button', { name: /Bagging, / })).toHaveCount(0);
});

test('an owner sees stock by location, sends a draft and clears alerts', async ({ page }) => {
  await enterDemo(page, 'Mustafa Hale');
  await expect(page.getByRole('tab', { name: 'Scan' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Locations' }).click();
  const locations = page.getByTestId('locations');
  await expect(locations.getByText('Oakland Roastery')).toBeVisible();
  await locations.getByRole('button', { name: 'Pick Aisle, West Coast Fulfillment' }).click();
  await expect(page.getByTestId('location').getByText('Ethiopia 12oz')).toBeVisible();
  await page.getByTestId('location').getByRole('button', { name: 'Go back' }).click();

  await page.getByRole('tab', { name: 'Orders' }).click();
  const orders = page.getByTestId('orders');
  await orders.getByRole('tab', { name: 'Drafts' }).click();
  await orders.getByRole('button', { name: /NW-1048/ }).click();
  await page.getByTestId('po').getByRole('button', { name: 'Mark as sent to supplier' }).click();
  await expect(page.getByTestId('po').getByText('NW-1048 is marked as sent. It is now open for receiving.')).toBeVisible();
  await expect(page.getByTestId('po').getByTestId('receive-po')).toBeVisible();
  await page.getByTestId('po').getByRole('button', { name: 'Go back' }).click();

  await page.getByRole('tab', { name: /Alerts, 3 unread/ }).click();
  const alerts = page.getByTestId('alerts');
  await alerts.getByRole('button', { name: 'Mark all 3 read' }).click();
  await expect(alerts.getByText('You are caught up. Nothing new since the last check.')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Alerts', exact: true })).toBeVisible();
});

test('a viewer reads every shelf but every stock action is locked', async ({ page }) => {
  await enterDemo(page, 'Jonah Peck');
  await expect(page.getByTestId('home').getByText('You have a viewer seat.', { exact: false })).toBeVisible();
  await page.goto('/item/prd_eth_green');
  const item = page.getByTestId('item');
  await expect(item.getByText('Ethiopia Yirgacheffe G1').first()).toBeVisible();
  await expect(item.getByRole('button', { name: 'Adjust', exact: true })).toHaveCount(0);
  await expect(item.getByText('Viewers can look, not post.', { exact: false })).toBeVisible();

  await page.goto('/receive/po_nw_1044');
  await expect(page.getByText('Viewers can look, not post.', { exact: false })).toBeVisible();
  await expect(page.getByTestId('post-receipt')).toHaveCount(0);
});

test('Harbor never sees Northwind, and the super admin switches workspaces', async ({ page, browser }) => {
  await enterDemo(page, 'Priya Shah');
  await page.getByRole('tab', { name: 'Items' }).click();
  await page.getByTestId('item-search').fill('Ethiopia');
  await expect(page.getByTestId('items').getByText('No matches')).toBeVisible();
  await page.goto('/item/prd_eth_green');
  await expect(page.getByText('That SKU is not in this workspace.')).toBeVisible();

  const admin = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await enterDemo(admin, 'Avery Quinn');
  await expect(admin.getByTestId('home').getByText('Northwind Coffee Roasters')).toBeVisible();
  await admin.getByRole('tab', { name: 'More' }).click();
  await admin.getByRole('button', { name: 'Switch to Harbor Auto Parts' }).click();
  await expect(admin.getByTestId('home').getByText('Harbor Auto Parts')).toBeVisible();
  await admin.close();
});

test('password sign-in, a magic link, and a deep link opened while signed out', async ({ page }) => {
  await page.goto('/po/po_nw_1044');
  await expect(page.getByRole('button', { name: 'Try the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Use Lena Ortiz' }).click();
  await expect(page.getByTestId('po').getByText('PacCoast Packaging → West Coast Fulfillment')).toBeVisible();

  await page.goto('/more');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('floor@harbor.demo');
  await page.getByRole('button', { name: 'Send magic link' }).click();
  await page.getByRole('button', { name: 'Open the link from the demo inbox' }).click();
  await expect(page.getByTestId('home').getByText('Harbor Auto Parts')).toBeVisible();
});
