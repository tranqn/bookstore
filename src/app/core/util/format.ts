import type { Locale, Money } from '../models/book';

/** Locale-aware currency formatting used across catalog, detail, and cart. */
export function formatMoney(price: Money, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    style: 'currency',
    currency: price.currency,
  }).format(price.amount);
}

/** Stable URL slug from a title — the catalog seed keys books on this. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
