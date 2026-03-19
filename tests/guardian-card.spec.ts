import { test, expect } from '@playwright/test';

test.describe('Guardian Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads without errors', async ({ page }) => {
    await expect(page).toHaveTitle(/Powerlevel/);
  });

  test('guardian name visible', async ({ page }) => {
    await expect(page.getByText('@castrojo')).toBeVisible();
  });

  test('power level displayed', async ({ page }) => {
    await expect(page.getByText(/◆ \d+/)).toBeVisible();
  });

  test('season name shown', async ({ page }) => {
    await expect(page.getByText(/Season of/)).toBeVisible();
  });

  test('six character stats rendered', async ({ page }) => {
    for (const stat of ['ENDURANCE', 'SYNTHESIS', 'BREADTH', 'FORESIGHT', 'OUTPUT', 'RECALL']) {
      await expect(page.getByText(stat)).toBeVisible();
    }
  });

  test('all 10 supers listed', async ({ page }) => {
    await expect(page.getByText('THUNDERCRASH')).toBeVisible();
    await expect(page.getByText('GLACIAL QUAKE')).toBeVisible();
    await expect(page.getByText('WARD OF DAWN')).toBeVisible();
  });

  test('nav links present', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Arsenal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Triumphs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Seals' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stats' })).toBeVisible();
  });
});
