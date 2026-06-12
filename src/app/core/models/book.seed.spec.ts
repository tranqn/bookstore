import { BookSeedSchema } from './book.schema';
import seed from '../../../assets/data/books.seed.json';

describe('books.seed.json', () => {
  it('matches the Book schema', () => {
    expect(() => BookSeedSchema.parse(seed)).not.toThrow();
  });

  it('has a healthy, well-distributed catalog', () => {
    const books = BookSeedSchema.parse(seed);
    expect(books.length).toBeGreaterThanOrEqual(20);

    const ids = new Set(books.map((b) => b.id));
    expect(ids.size).toBe(books.length); // unique slugs

    const genres = new Set(books.map((b) => b.genre));
    expect(genres.size).toBeGreaterThanOrEqual(4); // breadth across genres
  });

  it('uses self-hosted, optimized covers with LQIP and dimensions', () => {
    const books = BookSeedSchema.parse(seed);
    for (const b of books) {
      // scripts/optimize-covers.ts rewrites every cover to a local rendition.
      expect(b.cover.small).toBe(`/covers/${b.id}-96.webp`);
      expect(b.cover.medium).toBe(`/covers/${b.id}-320.webp`);
      expect(b.cover.large).toBe(`/covers/${b.id}-640.webp`);
      expect(b.cover.lqip).toMatch(/^data:image\/webp;base64,/);
      expect(b.cover.width).toBeGreaterThan(0);
      expect(b.cover.height).toBeGreaterThan(0);
    }
  });
});
