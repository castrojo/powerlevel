import { test, expect } from '@playwright/test';

test.describe('Activity Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./feed/');
  });

  test('page title visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Activity Feed');
  });

  test('feed renders content or empty state', async ({ page }) => {
    const hasFeed = await page.locator('.feed-list').count() > 0;
    const hasEmpty = await page.locator('.empty-state').count() > 0;
    expect(hasFeed || hasEmpty).toBe(true);
  });

  test('feed items are non-empty when data present', async ({ page }) => {
    const list = page.locator('.feed-list');
    if (await list.count() > 0) {
      const items = page.locator('.feed-item');
      await expect(items.first()).toBeVisible();
      const summary = await items.first().locator('.feed-summary').textContent();
      expect(summary).not.toContain('undefined');
      expect(summary?.trim().length).toBeGreaterThan(0);
    }
  });

  test('export timestamp present when data exists', async ({ page }) => {
    const list = page.locator('.feed-list');
    if (await list.count() > 0) {
      await expect(page.locator('.export-stamp')).toBeVisible();
    }
  });

  test('no undefined or NaN rendered', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });
});
