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

  it('uses real cover URLs (no placeholders)', () => {
    const books = BookSeedSchema.parse(seed);
    for (const b of books) {
      expect(b.cover.large).toMatch(/^https:\/\//);
    }
  });
});
