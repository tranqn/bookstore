/**
 * Build-time seed generator. Merges the hand-curated editorial layer
 * (scripts/curated-books.ts) with real book metadata:
 *
 *   1. Google Books API (primary) — cover art via the volume endpoint
 *      (higher-res imageLinks), ISBN-13, publish year, page count.
 *   2. Open Library (fallback) — cover art when Google has none.
 *
 * Every entry is validated against the zod `Book` schema and written to
 * src/assets/data/books.seed.json. Afterwards run `npm run optimize:covers`
 * to self-host the images and `npm run embed` for the semantic index.
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
const GOOGLE = 'https://www.googleapis.com/books/v1';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GoogleVolumeInfo {
  publishedDate?: string;
  pageCount?: number;
  industryIdentifiers?: { type: string; identifier: string }[];
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
}

interface GoogleMeta {
  isbn?: string;
  publishedYear?: number;
  cover?: BookCover;
}

/** Optional — raises the Google Books quota (anonymous requests share a
 *  small IP pool and 429 quickly). Create a free key in any GCP project. */
const GOOGLE_KEY = process.env['GOOGLE_BOOKS_API_KEY'];

async function fetchJson<T>(url: string): Promise<T | null> {
  const keyed =
    GOOGLE_KEY && url.startsWith(GOOGLE)
      ? `${url}${url.includes('?') ? '&' : '?'}key=${GOOGLE_KEY}`
      : url;
  const res = await fetch(keyed, { headers: { 'User-Agent': UA } });
  return res.ok ? ((await res.json()) as T) : null;
}

function toHttps(url: string): string {
  return url.replace('http://', 'https://');
}

/** Build a cover from a volume's imageLinks, largest rendition first.
 *  `zoom=` upgrades the plain thumbnail when no large rendition exists. */
function coverFromLinks(links?: GoogleVolumeInfo['imageLinks']): BookCover | null {
  if (!links) return null;
  const large =
    links.extraLarge ?? links.large ?? links.medium ?? links.small;
  if (large) {
    return {
      id: 0,
      small: toHttps(links.thumbnail ?? large),
      medium: toHttps(links.medium ?? large),
      large: toHttps(large),
    };
  }
  if (links.thumbnail) {
    const thumb = toHttps(links.thumbnail);
    return {
      id: 0,
      small: thumb,
      medium: thumb.replace('zoom=1', 'zoom=2'),
      large: thumb.replace('zoom=1', 'zoom=3'),
    };
  }
  return null;
}

async function googleVolume(c: CuratedBook): Promise<GoogleMeta | null> {
  const q = c.query ?? { title: c.title, author: c.author };
  // Strictest query shape first; German display titles often only hit on
  // the loose text search.
  const attempts = [
    `intitle:"${q.title}"${q.author ? `+inauthor:"${q.author}"` : ''}`,
    `${q.title} ${q.author ?? ''}`.trim(),
    `${c.title} ${c.author}`,
  ];

  for (const term of attempts) {
    const search = await fetchJson<{
      items?: { id: string; volumeInfo?: GoogleVolumeInfo }[];
    }>(`${GOOGLE}/volumes?q=${encodeURIComponent(term)}&maxResults=5`).catch(
      () => null,
    );
    const hit = search?.items?.find((i) => i.volumeInfo?.imageLinks?.thumbnail);
    if (!hit) {
      await sleep(150);
      continue;
    }

    // The volume endpoint exposes the larger imageLinks renditions that the
    // search response omits.
    const volume = await fetchJson<{ volumeInfo?: GoogleVolumeInfo }>(
      `${GOOGLE}/volumes/${hit.id}`,
    ).catch(() => null);
    const info = volume?.volumeInfo ?? hit.volumeInfo ?? {};
    const searchInfo = hit.volumeInfo ?? {};

    const isbn = (info.industryIdentifiers ?? searchInfo.industryIdentifiers)
      ?.sort((a, b) => (a.type === 'ISBN_13' ? -1 : b.type === 'ISBN_13' ? 1 : 0))
      .find((i) => i.type.startsWith('ISBN'))?.identifier;
    const year = parseInt(
      (info.publishedDate ?? searchInfo.publishedDate ?? '').slice(0, 4),
      10,
    );

    return {
      isbn,
      publishedYear: Number.isFinite(year) ? year : undefined,
      cover:
        coverFromLinks(info.imageLinks) ?? coverFromLinks(searchInfo.imageLinks),
    };
  }
  return null;
}

/** Open Library fallback — only consulted when Google has no usable cover. */
async function openLibraryCover(c: CuratedBook): Promise<BookCover | null> {
  const q = c.query ?? { title: c.title, author: c.author };
  const params = new URLSearchParams({
    title: q.title,
    limit: '5',
    fields: 'cover_i',
  });
  if (q.author) params.set('author', q.author);
  const json = await fetchJson<{ docs?: { cover_i?: number }[] }>(
    `https://openlibrary.org/search.json?${params}`,
  ).catch(() => null);
  const coverId = json?.docs?.find((d) => d.cover_i)?.cover_i;
  if (!coverId) return null;
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
  let olFallbacks = 0;
  let missingCover = 0;

  for (const c of curatedBooks) {
    const meta = await googleVolume(c).catch(() => null);

    let cover = meta?.cover ?? null;
    if (!cover) {
      cover = await openLibraryCover(c).catch(() => null);
      if (cover) olFallbacks++;
    }

    if (!cover) {
      missingCover++;
      console.warn(`  ⚠ no cover for "${c.title}" — skipped`);
      continue;
    }

    books.push({
      id: slugify(c.title),
      isbn: meta?.isbn,
      title: c.title,
      author: c.author,
      description: c.description,
      genre: c.genre,
      tags: c.tags,
      price: { amount: c.price, currency: 'EUR' },
      publishedYear: meta?.publishedYear ?? 2000,
      rating: c.rating,
      likeCount: c.likeCount,
      cover,
      pageCount: c.pageCount,
    });

    console.log(`  ✓ ${c.title}`);
    await sleep(250); // be polite to the APIs
  }

  const parsed = BookSeedSchema.parse(books);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(parsed, null, 2) + '\n', 'utf8');

  console.log(
    `\nWrote ${parsed.length} books → ${OUT}` +
      `\n  Google Books covers:    ${parsed.length - olFallbacks}` +
      `\n  Open Library fallbacks: ${olFallbacks}` +
      `\n  Skipped (no cover):     ${missingCover}`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
