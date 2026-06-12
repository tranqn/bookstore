import { expect, test } from '@playwright/test';

test.describe('commerce flow', () => {
  test('browse → filter → detail → cart → checkout → order confirmation', async ({
    page,
  }) => {
    await page.goto('/catalog');

    // Genre filter narrows the grid and mirrors into the URL.
    await page.getByRole('button', { name: 'Science-Fiction' }).click();
    await expect(page).toHaveURL(/genre=Science-Fiction/);

    // Open a book through its card.
    await page.getByRole('link', { name: /Dune/ }).first().click();
    await expect(page).toHaveURL(/\/book\/dune-der-wustenplanet/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dune');

    // Add to cart — the drawer opens with one line item.
    await page.getByRole('button', { name: 'In den Warenkorb' }).click();
    const drawer = page.getByRole('dialog', { name: 'Warenkorb' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Dune – Der Wüstenplanet')).toBeVisible();

    // Quantity controls update the line.
    await drawer.getByRole('button', { name: '+' }).click();
    await expect(drawer.getByText('2', { exact: true })).toBeVisible();

    await drawer.getByRole('link', { name: 'Zur Kasse' }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // Step 0 → 1: cart review.
    await page.getByRole('button', { name: 'Weiter' }).click();

    // Invalid email surfaces an inline error before advancing.
    await page.getByLabel('E-Mail').fill('nope');
    await page.getByLabel('Name').click();
    await expect(
      page.getByText('Bitte eine gültige E-Mail-Adresse angeben.'),
    ).toBeVisible();

    await page.getByLabel('Name').fill('Quoc Nam Tran');
    await page.getByLabel('E-Mail').fill('nam@example.com');
    await page.getByLabel('Straße und Hausnummer').fill('Musterstraße 12');
    await page.getByLabel('PLZ').fill('50667');
    await page.getByLabel('Stadt').fill('Köln');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // Step 2: payment.
    await page.getByLabel('Kartennummer').fill('4242 4242 4242 4242');
    await page.getByRole('button', { name: 'Jetzt bezahlen' }).click();

    // Step 3: confirmation with a generated order id; cart is now empty.
    await expect(page.getByText(/BK-[A-Z0-9]{6}/)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Vielen Dank für deine Bestellung!' }),
    ).toBeVisible();
  });

  test('favorites persist across reloads', async ({ page }) => {
    await page.goto('/book/momo');
    await page.getByRole('button', { name: /Merken/ }).click();
    await expect(page.getByRole('button', { name: /Gemerkt/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /Gemerkt/ })).toBeVisible();

    await page.goto('/favorites');
    await expect(page.getByRole('link', { name: /Momo/ })).toBeVisible();
  });

  test('locale switch persists and translates the UI', async ({ page }) => {
    await page.goto('/catalog');
    await page.getByRole('button', { name: /Sprache wechseln/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Catalog' }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Catalog' }),
    ).toBeVisible();
  });
});
