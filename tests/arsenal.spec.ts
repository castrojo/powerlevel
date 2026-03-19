import { test, expect } from '@playwright/test';

test.describe('Arsenal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/arsenal');
  });

  test('page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Arsenal');
  });

  test('all 5 subclasses rendered', async ({ page }) => {
    for (const sc of ['VELOCITY', 'COMMUNITY', 'MASTERY', 'DISTRIBUTION', 'STABILITY']) {
      await expect(page.getByText(sc).first()).toBeVisible();
    }
  });

  test('Trustee primary weapon shown', async ({ page }) => {
    await expect(page.getByText('Trustee')).toBeVisible();
  });

  test('primary badge visible', async ({ page }) => {
    await expect(page.getByText('★ PRIMARY')).toBeVisible();
  });

  test('weapon cards have level bars', async ({ page }) => {
    const bars = page.locator('.level-bar');
    const count = await bars.count();
    expect(count).toBeGreaterThan(30);
  });
});
