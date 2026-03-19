import { test, expect } from '@playwright/test';

test.describe('Stats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./stats/');
  });

  test('page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Stats');
  });

  test('all six stats rendered', async ({ page }) => {
    for (const s of ['RECALL', 'ENDURANCE', 'SYNTHESIS', 'BREADTH', 'FORESIGHT', 'OUTPUT']) {
      await expect(page.getByText(s).first()).toBeVisible();
    }
  });

  test('stat score bars present', async ({ page }) => {
    const fills = page.locator('.stat-fill');
    expect(await fills.count()).toBeGreaterThan(5);
  });

  test('milestones section present', async ({ page }) => {
    await expect(page.getByText('Milestones')).toBeVisible();
  });

  test('soft cap marker renders', async ({ page }) => {
    await expect(page.locator('.soft-cap-marker').first()).toBeVisible();
  });

  test('last updated shown', async ({ page }) => {
    await expect(page.getByText(/Last updated/)).toBeVisible();
  });

  test('radar chart renders', async ({ page }) => {
    await expect(page.locator('svg.radar-chart')).toBeVisible();
    const polygon = page.locator('svg.radar-chart polygon').last();
    await expect(polygon).toBeVisible();
  });

  test('stat values are non-zero', async ({ page }) => {
    const fills = page.locator('.stat-fill');
    const count = await fills.count();
    expect(count).toBeGreaterThan(0);
    let hasNonZero = false;
    for (let i = 0; i < count; i++) {
      const style = await fills.nth(i).getAttribute('style');
      if (style && !style.includes('width: 0')) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  test('model dispatch section renders (empty or populated)', async ({ page }) => {
    await expect(page.getByText('Model Dispatch Log')).toBeVisible();
    // Either the empty state OR the summary stats are present
    const hasEmpty = await page.getByText('No dispatches logged yet').isVisible().catch(() => false);
    const hasSummary = await page.locator('.model-summary').isVisible().catch(() => false);
    const hasEmptyAlt = await page.getByText('Arsenal cold').isVisible().catch(() => false);
    expect(hasEmpty || hasSummary || hasEmptyAlt).toBe(true);
  });
});
