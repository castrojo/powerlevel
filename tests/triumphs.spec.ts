import { test, expect } from '@playwright/test';

test.describe('Triumphs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triumphs');
  });

  test('page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Triumph');
  });

  test('point total shown', async ({ page }) => {
    await expect(page.getByText(/\d+ pts/)).toBeVisible();
  });

  test('all element categories present', async ({ page }) => {
    for (const cat of ['VELOCITY', 'COMMUNITY', 'MASTERY', 'DISTRIBUTION', 'STABILITY']) {
      await expect(page.getByText(cat).first()).toBeVisible();
    }
  });

  test('secret triumph shows classified', async ({ page }) => {
    await expect(page.getByText('CLASSIFIED')).toBeVisible();
  });

  test('triumph flavor text rendered', async ({ page }) => {
    await expect(page.getByText(/The Traveler's light is new/)).toBeVisible();
  });
});
