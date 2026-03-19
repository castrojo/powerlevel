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

  test('export timestamp shown', async ({ page }) => {
    await expect(page.getByText(/Last exported/)).toBeVisible();
  });
});
