import { test, expect } from '@playwright/test';

test.describe('Seals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./seals/');
  });

  test('page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Seal');
  });

  test('all 5 seals rendered', async ({ page }) => {
    for (const seal of ['CONQUEROR', 'CURSEBREAKER', 'CHRONICLER', 'WEAPONSMITH', 'IRON LORD']) {
      await expect(page.getByText(seal).first()).toBeVisible();
    }
  });

  test('progress SVG rings present', async ({ page }) => {
    const rings = page.locator('svg circle[stroke-dasharray]');
    const count = await rings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('seal difficulty labels shown', async ({ page }) => {
    await expect(page.getByText('pinnacle')).toBeVisible();
  });

  test('seasonal seal shows expiry', async ({ page }) => {
    await expect(page.getByText(/Expires/)).toBeVisible();
  });
});
