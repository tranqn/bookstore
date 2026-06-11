import { formatMoney, slugify } from './format';

describe('formatMoney', () => {
  it('formats EUR for German locale', () => {
    const out = formatMoney({ amount: 19.99, currency: 'EUR' }, 'de');
    expect(out).toContain('19,99');
    expect(out).toContain('€');
  });

  it('formats EUR for English locale', () => {
    const out = formatMoney({ amount: 19.99, currency: 'EUR' }, 'en');
    expect(out).toContain('19.99');
  });
});

describe('slugify', () => {
  it('strips German diacritics and lowercases', () => {
    expect(slugify('Die Geheimnisse des Ozeans')).toBe(
      'die-geheimnisse-des-ozeans',
    );
    expect(slugify('Über Bücher & Träume')).toBe('uber-bucher-traume');
  });
});
