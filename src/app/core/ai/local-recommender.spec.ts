import { localRecommend } from './local-recommender';
import { BookSeedSchema } from '../models/book.schema';
import seed from '../../../assets/data/books.seed.json';

const books = BookSeedSchema.parse(seed);

describe('localRecommend', () => {
  it('returns ranked recommendations with valid catalog ids', () => {
    const recs = localRecommend('a gripping thriller', books, 'en', 4);
    expect(recs.length).toBe(4);
    const ids = new Set(books.map((b) => b.id));
    for (const r of recs) {
      expect(ids.has(r.bookId)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('surfaces a matching genre near the top', () => {
    const recs = localRecommend('spannender Thriller', books, 'de', 4);
    const top = books.find((b) => b.id === recs[0].bookId);
    expect(top?.genre).toBe('Thriller');
  });

  it('still returns picks when the query matches nothing', () => {
    const recs = localRecommend('zzzz qqqq', books, 'en', 3);
    expect(recs.length).toBe(3);
  });
});
