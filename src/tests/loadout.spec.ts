import { test, expect } from '@playwright/test';

test.describe('Loadout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./loadout/');
  });

  test('page title visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Loadout');
  });

  test('kinetic slot populated', async ({ page }) => {
    await expect(page.locator('.loadout-slot.kinetic')).toBeVisible();
    const weaponName = page.locator('.loadout-slot.kinetic .slot-weapon');
    await expect(weaponName).toBeVisible();
    const text = await weaponName.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
    expect(text).not.toBe('undefined');
  });

  test('subclass node visible', async ({ page }) => {
    await expect(page.locator('.subclass-node')).toBeVisible();
  });

  test('armor slots rendered', async ({ page }) => {
    const slots = page.locator('.armor-slot');
    await expect(slots.first()).toBeVisible();
    const count = await slots.count();
    expect(count).toBe(6);
  });

  test('no undefined or NaN', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });
});
