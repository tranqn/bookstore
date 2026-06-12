import { expect, test } from '@playwright/test';

test.describe('AI recommender', () => {
  test('renders ranked results from the BFF', async ({ page }) => {
    // Deterministic stub — the real endpoint shape, no Gemini dependency.
    await page.route('**/api/recommend', (route) =>
      route.fulfill({
        json: {
          source: 'gemini',
          results: [
            { bookId: 'momo', reason: 'Zeitlose Fantasy über Zeit.', score: 0.93 },
            { bookId: 'dune-der-wustenplanet', reason: 'Epische Weite.', score: 0.71 },
          ],
        },
      }),
    );

    await page.goto('/recommender');
    await page.getByRole('textbox').fill('verträumte fantasy');
    await page.getByRole('button', { name: 'Empfehlungen finden' }).click();

    const results = page.getByRole('listitem');
    await expect(results.first()).toContainText('Momo');
    await expect(results.first()).toContainText('93%');
    await expect(page.getByText('Empfohlen von Gemini')).toBeVisible();
  });

  test('falls back to the local recommender when the BFF is down', async ({
    page,
  }) => {
    await page.route('**/api/recommend', (route) => route.abort());

    await page.goto('/recommender');
    await page.getByRole('textbox').fill('fantasy');
    await page.getByRole('button', { name: 'Empfehlungen finden' }).click();

    await expect(page.getByText('Empfohlen vom lokalen Modell')).toBeVisible();
    await expect(page.getByRole('listitem').first()).toBeVisible();
  });
});
