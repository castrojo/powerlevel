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

  test('lore archive book grid visible', async ({ page }) => {
    await expect(page.locator('.book-grid')).toBeVisible();
    const cards = page.locator('.book-hero-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
  });

  test('lore stream visible', async ({ page }) => {
    await expect(page.locator('.stream-section')).toBeVisible();
    await expect(page.locator('.stream-entry').first()).toBeVisible();
  });

  test('book reader opens on card click', async ({ page }) => {
    await page.locator('.book-hero-card').first().click();
    await expect(page.locator('.book-reader.reader-open')).toBeVisible();
    await expect(page.locator('.reader-chapter-list')).toBeVisible();
    await expect(page.locator('.reader-content')).toBeVisible();
  });

  test('exo question readable via reader', async ({ page }) => {
    // Open the Bluefin Chronicle (first book)
    await page.locator('.book-hero-card').first().click();
    // Click chapter 6 (The Exo Question)
    const exoCh = page.locator('.cl-entry', { hasText: 'The Exo Question' });
    await exoCh.click();
    await expect(page.locator('.reader-content')).toContainText('Am I human or am I machine');
    await expect(page.locator('.reader-content')).toContainText('An Unknown Exo');
  });

  test('reader closes with close button', async ({ page }) => {
    await page.locator('.book-hero-card').first().click();
    await page.locator('#reader-close').click();
    await expect(page.locator('.book-reader')).not.toHaveClass(/reader-open/);
  });
});
