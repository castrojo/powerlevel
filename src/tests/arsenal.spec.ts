import { test, expect } from '@playwright/test';

test.describe('Arsenal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./arsenal/');
  });

  test('page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Arsenal');
  });

  test('all 5 subclasses rendered', async ({ page }) => {
    // Subclasses display by domain name in h2.subclass-name
    const headings = page.locator('h2.subclass-name');
    await expect(headings.first()).toBeVisible();
    const count = await headings.count();
    expect(count).toBe(5);
  });

  test('Trustee primary weapon shown', async ({ page }) => {
    await expect(page.getByText('Trustee')).toBeVisible();
  });

  test('primary badge visible', async ({ page }) => {
    await expect(page.locator('.primary-badge')).toBeVisible();
  });

  test('weapon cards have level bars', async ({ page }) => {
    const bars = page.locator('.level-bar');
    await expect(bars.first()).toBeVisible();
    const count = await bars.count();
    expect(count).toBeGreaterThan(10);
  });
});
