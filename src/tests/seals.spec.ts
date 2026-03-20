import { test, expect } from '@playwright/test';

test.describe('Seals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./seals/');
  });

  test('page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Seal');
  });

  test('all 17 seals rendered', async ({ page }) => {
    const cards = page.locator('.seal-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(17);
  });

  test('all original seals present', async ({ page }) => {
    for (const seal of ['CONQUEROR', 'CURSEBREAKER', 'CHRONICLER', 'BLACKSMITH', 'IRON LORD']) {
      await expect(page.getByText(seal).first()).toBeVisible();
    }
  });

  test('new seal categories present', async ({ page }) => {
    for (const seal of ['WARDEN', 'SPIREKEEPER', 'PATHFINDER']) {
      await expect(page.getByText(seal).first()).toBeVisible();
    }
  });

  test('progress SVG rings present for all seals', async ({ page }) => {
    const rings = page.locator('svg circle[stroke-dasharray]');
    const count = await rings.count();
    expect(count).toBeGreaterThanOrEqual(17);
  });

  test('seal progress shows N/M triumphs format', async ({ page }) => {
    // Each .seal-progress should show "X / Y triumphs" with Y > 0
    // This catches compute.py failing to populate total_triumphs in seals.json
    const progresses = page.locator('.seal-progress');
    const count = await progresses.count();
    expect(count).toBeGreaterThanOrEqual(17);
    for (let i = 0; i < count; i++) {
      const text = await progresses.nth(i).textContent();
      // Must match "N / M triumphs" where M > 0 (total_triumphs computed from required_triumph_ids)
      expect(text).toMatch(/\d+ \/ [1-9]\d* triumphs/);
    }
  });

  test('seal difficulty labels shown', async ({ page }) => {
    await expect(page.getByText('pinnacle').first()).toBeVisible();
  });

  test('seasonal seal shows expiry', async ({ page }) => {
    await expect(page.getByText(/Expires/)).toBeVisible();
  });
});
