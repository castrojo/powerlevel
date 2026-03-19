import { test, expect } from '@playwright/test';

test.describe('Lore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./lore/');
  });

  test('page title visible', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('season story rendered', async ({ page }) => {
    await expect(page.getByText(/Season of/)).toBeVisible();
  });

  test('guardian bio visible', async ({ page }) => {
    await expect(page.locator('h2.lore-title').first()).toBeVisible();
  });

  test('ghost messages present', async ({ page }) => {
    const msgs = page.locator('.ghost-msg');
    await expect(msgs.first()).toBeVisible();
    const count = await msgs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('all 5 elements rendered', async ({ page }) => {
    for (const el of ['VELOCITY', 'COMMUNITY', 'MASTERY', 'DISTRIBUTION', 'STABILITY']) {
      await expect(page.locator('.element-name', { hasText: el })).toBeVisible();
    }
  });

  test('no undefined or NaN', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });
});
