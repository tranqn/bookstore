import seed from '../src/assets/data/books.seed.json';
import type { Book } from '../src/app/core/models/book';
import { semanticRecommend } from '../src/server/semantic-recommender';

async function main() {
  const books = seed as Book[];
  const t0 = Date.now();
  const de = await semanticRecommend('verträumte Fantasy für einen Regentag', books, 'de', 4);
  const warm = Date.now();
  const en = await semanticRecommend('I want to get smarter about how humans think', books, 'en', 4);
  console.log('DE:', de.map((r) => `${r.bookId} (${r.score})`).join(', '));
  console.log('EN:', en.map((r) => `${r.bookId} (${r.score})`).join(', '));
  console.log('cold ms:', warm - t0, '| warm ms:', Date.now() - warm);
}
main();
