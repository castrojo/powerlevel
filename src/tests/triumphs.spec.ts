import { test, expect } from '@playwright/test';

test.describe('Triumphs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./triumphs/');
  });

  test('page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Triumphs');
  });

  test('point total shown', async ({ page }) => {
    // Header renders "{earned} / {total} points" across score spans
    await expect(page.locator('.score-label')).toBeVisible();
  });

  test('all element categories present', async ({ page }) => {
    // Each category renders as a h2 within the triumph-category sections
    const catHeadings = page.locator('h2.cat-header');
    await expect(catHeadings.first()).toBeVisible();
    const count = await catHeadings.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('secret triumph shows classified', async ({ page }) => {
    await expect(page.getByText(/Classified/i)).toBeVisible();
  });

  test('triumph flavor text rendered', async ({ page }) => {
    const flavor = page.locator('.triumph-flavor');
    await expect(flavor.first()).toBeVisible();
  });
});
