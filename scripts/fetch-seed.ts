/**
 * Build-time seed generator. Merges the hand-curated editorial layer
 * (scripts/curated-books.ts) with real cover art, ISBN and publish year from
 * Open Library (Google Books as a cover fallback), validates every entry
 * against the zod `Book` schema, and writes src/assets/data/books.seed.json.
 *
 * Run with:  npm run seed
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curatedBooks, type CuratedBook } from './curated-books';
import { BookSeedSchema } from '../src/app/core/models/book.schema';
import { slugify } from '../src/app/core/util/format';
import type { Book, BookCover } from '../src/app/core/models/book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/assets/data/books.seed.json');
const UA = 'bookstore-portfolio/1.0 (seed-script)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OlDoc {
  cover_i?: number;
  isbn?: string[];
  first_publish_year?: number;
}

async function openLibrary(c: CuratedBook): Promise<OlDoc | null> {
  const q = c.query ?? { title: c.title, author: c.author };
  const params = new URLSearchParams({
    title: q.title,
    limit: '5',
    fields: 'cover_i,isbn,first_publish_year',
  });
  if (q.author) params.set('author', q.author);
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { docs?: OlDoc[] };
  const docs = json.docs ?? [];
  // Prefer the first edition that actually has cover art; fall back to the
  // top match for isbn/year metadata.
  return docs.find((d) => d.cover_i) ?? docs[0] ?? null;
}

async function googleCover(c: CuratedBook): Promise<string | null> {
  const q = c.query ?? { title: c.title, author: c.author };
  const term = `intitle:${q.title}${q.author ? `+inauthor:${q.author}` : ''}`;
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&maxResults=1`,
    { headers: { 'User-Agent': UA } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    items?: { volumeInfo?: { imageLinks?: { thumbnail?: string } } }[];
  };
  const url = json.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
  return url ? url.replace('http://', 'https://') : null;
}

function olCover(coverId: number): BookCover {
  const base = `https://covers.openlibrary.org/b/id/${coverId}`;
  return {
    id: coverId,
    small: `${base}-S.jpg`,
    medium: `${base}-M.jpg`,
    large: `${base}-L.jpg`,
  };
}

async function build(): Promise<void> {
  const books: Book[] = [];
  let googleFallbacks = 0;
  let missingCover = 0;

  for (const c of curatedBooks) {
    const doc = await openLibrary(c).catch(() => null);

    let cover: BookCover | null = null;
    if (doc?.cover_i) {
      cover = olCover(doc.cover_i);
    } else {
      const g = await googleCover(c).catch(() => null);
      if (g) {
        cover = { id: 0, small: g, medium: g, large: g };
        googleFallbacks++;
      }
    }

    if (!cover) {
      missingCover++;
      console.warn(`  ⚠ no cover for "${c.title}" — skipped`);
      continue;
    }

    const isbn =
      doc?.isbn?.find((i) => i.length === 13) ?? doc?.isbn?.[0] ?? undefined;

    books.push({
      id: slugify(c.title),
      isbn,
      title: c.title,
      author: c.author,
      description: c.description,
      genre: c.genre,
      tags: c.tags,
      price: { amount: c.price, currency: 'EUR' },
      publishedYear: doc?.first_publish_year ?? 2000,
      rating: c.rating,
      likeCount: c.likeCount,
      cover,
      pageCount: c.pageCount,
    });

    console.log(`  ✓ ${c.title}`);
    await sleep(250); // be polite to Open Library
  }

  const parsed = BookSeedSchema.parse(books);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(parsed, null, 2) + '\n', 'utf8');

  console.log(
    `\nWrote ${parsed.length} books → ${OUT}` +
      `\n  Open Library covers: ${parsed.length - googleFallbacks}` +
      `\n  Google fallbacks:    ${googleFallbacks}` +
      `\n  Skipped (no cover):  ${missingCover}`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
