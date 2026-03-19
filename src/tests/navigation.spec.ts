import { test, expect } from '@playwright/test';

/**
 * Navigation regression tests.
 *
 * These tests verify that nav links are correct rendered hrefs (not concatenated
 * paths like /powerlevelfeed) and that clicking each link actually loads the
 * target page. The previous test suite used page.goto() which bypassed nav links
 * entirely — causing all 47 tests to pass while every nav link was broken.
 */
test.describe('Nav link correctness', () => {
  test('nav links have correct /powerlevel/ prefix (no concatenation)', async ({ page }) => {
    await page.goto('./');
    const navLinks = await page.locator('nav a[href]').all();
    for (const link of navLinks) {
      const href = await link.getAttribute('href');
      if (!href) continue;
      // Skip external links (e.g. GitHub)
      if (href.startsWith('http')) continue;
      // Every internal link must start with /powerlevel/ — never /powerlevel[a-z]
      expect(href, `Nav link "${href}" is missing the separator slash`).toMatch(
        /^\/powerlevel\//
      );
    }
  });

  test('favicon href has correct path', async ({ page }) => {
    await page.goto('./');
    const favicon = page.locator('link[rel="icon"]');
    const href = await favicon.getAttribute('href');
    expect(href, 'Favicon href must be /powerlevel/favicon.svg').toBe(
      '/powerlevel/favicon.svg'
    );
  });
});

test.describe('Nav link navigation', () => {
  const pages = [
    { name: 'Arsenal', href: /\/powerlevel\/arsenal/, title: /Arsenal/ },
    { name: 'Triumphs', href: /\/powerlevel\/triumphs/, title: /Triumphs/ },
    { name: 'Seals', href: /\/powerlevel\/seals/, title: /Seals/ },
    { name: 'Stats', href: /\/powerlevel\/stats/, title: /Stats/ },
    { name: 'Feed', href: /\/powerlevel\/feed/, title: /Feed/ },
    { name: 'Lore', href: /\/powerlevel\/lore/, title: /Lore/ },
    { name: 'Loadout', href: /\/powerlevel\/loadout/, title: /Loadout/ },
  ];

  for (const p of pages) {
    test(`clicking "${p.name}" nav link navigates and loads page`, async ({ page }) => {
      await page.goto('./');
      const link = page.locator(`nav a`, { hasText: p.name });
      await expect(link).toBeVisible();
      // Verify the href attribute itself is correct before clicking
      const href = await link.getAttribute('href');
      expect(href, `${p.name} nav href`).toMatch(p.href);
      // Actually click and verify the target page loads
      await link.click();
      await expect(page).toHaveTitle(p.title);
      expect(page.url(), `URL after clicking ${p.name}`).toMatch(p.href);
    });
  }

  test('brand logo navigates home', async ({ page }) => {
    await page.goto('./arsenal/');
    await page.locator('a.nav-brand').click();
    await expect(page).toHaveTitle(/Guardian Card|Powerlevel/);
    expect(page.url()).toMatch(/\/powerlevel\/?$/);
  });
});
