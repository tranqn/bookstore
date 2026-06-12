import { expect, test } from '@playwright/test';

test.describe('command palette', () => {
  test('Ctrl+K → fuzzy search → Enter opens the book', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Schnellsuche' });
    await expect(palette).toBeVisible();

    const input = palette.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('dune');
    await expect(palette.getByRole('option', { name: /Dune/ })).toBeVisible();

    await input.press('Enter');
    await expect(page).toHaveURL(/\/book\/dune-der-wustenplanet/);
    await expect(palette).not.toBeVisible();
  });

  test('runs quick actions (theme toggle) and closes on Escape', async ({
    page,
  }) => {
    await page.goto('/');
    const html = page.locator('html');
    const wasLight = ((await html.getAttribute('class')) ?? '').includes('light');

    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Schnellsuche' });
    const input = palette.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('farbschema');
    await expect(
      palette.getByRole('option', { name: /Farbschema/ }),
    ).toBeVisible();
    await input.press('Enter');

    await expect
      .poll(async () => ((await html.getAttribute('class')) ?? '').includes('light'))
      .toBe(!wasLight);
    await expect(palette).not.toBeVisible();

    await page.keyboard.press('ControlOrMeta+k');
    await expect(input).toBeFocused();
    await input.press('Escape');
    await expect(palette).not.toBeVisible();
  });
});
