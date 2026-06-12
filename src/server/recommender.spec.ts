import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRecommendations } from './recommender';

describe('server recommender BFF', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to the local recommender when GEMINI_API_KEY is absent', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const { results, source } = await getRecommendations('fantasy', 'de', 4);

    expect(source).toBe('local');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(4);
  });

  it('only ever returns ids that exist in the catalog', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const { results } = await getRecommendations('spannend', 'de', 4);
    const seed = await import('../assets/data/books.seed.json');
    const ids = new Set(seed.default.map((b: { id: string }) => b.id));

    for (const r of results) {
      expect(ids.has(r.bookId)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns localized reasons', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const de = await getRecommendations('fantasy', 'de', 2);
    const en = await getRecommendations('fantasy', 'en', 2);

    expect(de.results[0]?.reason).not.toBe(en.results[0]?.reason);
  });
});
