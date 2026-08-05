import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  '/',
  '/catalog',
  '/book/momo',
  '/recommender',
  '/favorites',
  '/checkout',
  '/architecture',
];

async function audit(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The 3D canvas route is covered separately via its grid fallback.
    .exclude('canvas')
    .analyze();
  expect(results.violations).toEqual([]);
}

for (const route of ROUTES) {
  test(`axe (WCAG AA): ${route} — dark`, async ({ page }) => {
    await page.goto(route);
    await audit(page);
  });

  test(`axe (WCAG AA): ${route} — light`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('button', { name: 'Farbschema wechseln' }).click();
    // The surface variables swap instantly, the text colours ride a 150ms
    // `transition-colors`. Auditing inside that window samples half-blended
    // foregrounds and reports a contrast failure for every string on the page,
    // so let the swap settle before measuring.
    await page.waitForTimeout(300);
    await audit(page);
  });
}

test('axe (WCAG AA): /gallery grid fallback', async ({ page }) => {
  // Reduced motion forces the accessible grid fallback instead of WebGL.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/gallery');
  await audit(page);
});

test('skip link focuses main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
});
