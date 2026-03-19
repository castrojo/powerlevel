import { test, expect } from '@playwright/test';

test.describe('Guardian Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('page loads without errors', async ({ page }) => {
    await expect(page).toHaveTitle(/Powerlevel/);
  });

  test('guardian name visible', async ({ page }) => {
    // h1.guardian-name — strict locator to avoid matching nav brand
    await expect(page.locator('h1.guardian-name')).toBeVisible();
  });

  test('power level displayed', async ({ page }) => {
    await expect(page.getByText(/◆ \d+/)).toBeVisible();
  });

  test('season name shown', async ({ page }) => {
    await expect(page.getByText(/Season of/)).toBeVisible();
  });

  test('six character stats rendered', async ({ page }) => {
    const statNames = ['RECALL', 'ENDURANCE', 'SYNTHESIS', 'BREADTH', 'FORESIGHT', 'OUTPUT'];
    for (const stat of statNames) {
      await expect(page.getByText(stat)).toBeVisible();
    }
  });

  test('all 10 supers listed', async ({ page }) => {
    const supers = [
      'THUNDERCRASH', 'HAMMER OF SOL', 'BURNING MAUL',
      'SENTINEL SHIELD', 'WARD OF DAWN', 'BLADEFURY', 'GLACIAL QUAKE',
    ];
    for (const s of supers) {
      await expect(page.getByText(s)).toBeVisible();
    }
  });

  test('nav links present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Arsenal/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Triumphs/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Seals/i })).toBeVisible();
  });
});
