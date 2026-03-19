import { test, expect, type Page } from '@playwright/test';

/**
 * Theme toggle tests.
 *
 * Key design:
 * - All system-preference tests use explicit colorScheme contexts — never rely
 *   on the CI/machine default, which is non-deterministic.
 * - "System" mode = localStorage key absent (never stores the string 'system').
 * - Media query listener must be detached when the user picks an explicit theme.
 */

async function clearTheme(page: Page) {
  await page.evaluate(() => localStorage.removeItem('pl-theme'));
}

// ── Structure tests ────────────────────────────────────────────────────────────

test.describe('toggle structure', () => {
  test('renders 3 toggle buttons in the nav', async ({ page }) => {
    await page.goto('./');
    const group = page.locator('[aria-label="Color theme"]');
    await expect(group).toBeVisible();
    await expect(group.locator('[data-theme-btn="system"]')).toBeVisible();
    await expect(group.locator('[data-theme-btn="light"]')).toBeVisible();
    await expect(group.locator('[data-theme-btn="dark"]')).toBeVisible();
  });

  test('toggle buttons have aria-labels', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('[data-theme-btn="system"]')).toHaveAttribute('aria-label', 'System theme');
    await expect(page.locator('[data-theme-btn="light"]')).toHaveAttribute('aria-label', 'Light theme');
    await expect(page.locator('[data-theme-btn="dark"]')).toHaveAttribute('aria-label', 'Dark theme');
  });
});

// ── System mode (OS-following) ─────────────────────────────────────────────────

test.describe('system mode — dark OS', () => {
  test('defaults to dark theme when OS is dark and no localStorage', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('./');
    await clearTheme(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ctx.close();
  });
});

test.describe('system mode — light OS', () => {
  test('defaults to light theme when OS is light and no localStorage', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('./');
    await clearTheme(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await ctx.close();
  });
});

// ── Explicit mode picking ──────────────────────────────────────────────────────

test.describe('explicit theme picks', () => {
  test('clicking Light sets data-theme=light and stores pl-theme=light', async ({ page }) => {
    await page.goto('./');
    await clearTheme(page);
    await page.locator('[data-theme-btn="light"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const stored = await page.evaluate(() => localStorage.getItem('pl-theme'));
    expect(stored).toBe('light');
  });

  test('clicking Dark sets data-theme=dark and stores pl-theme=dark', async ({ page }) => {
    await page.goto('./');
    await clearTheme(page);
    await page.locator('[data-theme-btn="dark"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const stored = await page.evaluate(() => localStorage.getItem('pl-theme'));
    expect(stored).toBe('dark');
  });
});

// ── Returning to System mode ───────────────────────────────────────────────────

test.describe('returning to system mode', () => {
  test('clicking System removes localStorage key', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('./');
    // Set an explicit preference first
    await page.locator('[data-theme-btn="dark"]').click();
    expect(await page.evaluate(() => localStorage.getItem('pl-theme'))).toBe('dark');
    // Now reset to system
    await page.locator('[data-theme-btn="system"]').click();
    const stored = await page.evaluate(() => localStorage.getItem('pl-theme'));
    expect(stored).toBeNull();
    // Theme should now follow OS (light)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await ctx.close();
  });
});

// ── Persistence ────────────────────────────────────────────────────────────────

test.describe('persistence across reload', () => {
  test('explicit Light persists after reload', async ({ page }) => {
    await page.goto('./');
    await page.locator('[data-theme-btn="light"]').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('explicit Dark persists after reload', async ({ page }) => {
    await page.goto('./');
    await page.locator('[data-theme-btn="dark"]').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('system mode follows OS after reload (no stored key)', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('./');
    await clearTheme(page);
    await page.reload();
    const stored = await page.evaluate(() => localStorage.getItem('pl-theme'));
    expect(stored).toBeNull();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ctx.close();
  });
});

// ── OS-change reactivity ───────────────────────────────────────────────────────

test.describe('OS preference change reactivity', () => {
  test('system mode reacts live to OS changing from dark to light', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('./');
    await clearTheme(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Simulate OS switching to light
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await ctx.close();
  });

  test('explicit mode does NOT react to OS changes', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('./');
    await page.locator('[data-theme-btn="light"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    // OS switches to dark — explicit preference should hold
    await page.emulateMedia({ colorScheme: 'dark' });
    // Give any listener time to fire (it shouldn't)
    await page.waitForTimeout(200);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await ctx.close();
  });
});
