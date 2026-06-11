import type { Book, Locale, Recommendation } from '../models/book';

/**
 * Deterministic, dependency-free "describe a mood → books" recommender.
 * It is the safety net the AI feature always falls back to: it runs on the
 * server when no GEMINI_API_KEY is configured, and on the client when the
 * /api/recommend endpoint is unreachable (e.g. plain `ng serve`).
 */

const STOPWORDS = new Set([
  // de
  'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'ich', 'mir', 'mich',
  'ein', 'mit', 'für', 'auf', 'ist', 'war', 'wie', 'was', 'ein', 'etwas',
  'lust', 'auf', 'nach', 'über', 'zum', 'zur', 'den', 'dem', 'des',
  // en
  'the', 'and', 'or', 'a', 'an', 'i', 'me', 'my', 'with', 'for', 'on', 'is',
  'was', 'like', 'want', 'something', 'about', 'to', 'of', 'in', 'feel',
  'feeling', 'book', 'books', 'read', 'reading', 'buch', 'bücher', 'lesen',
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function hay(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

interface Scored {
  book: Book;
  score: number;
  hitTags: string[];
  genreHit: boolean;
}

function scoreBook(book: Book, terms: string[]): Scored {
  const title = hay(book.title);
  const author = hay(book.author);
  const genre = hay(book.genre);
  const tags = book.tags.map(hay);
  const desc = hay(`${book.description.de} ${book.description.en}`);

  let score = 0;
  const hitTags: string[] = [];
  let genreHit = false;

  for (const term of terms) {
    if (title.includes(term)) score += 3;
    if (author.includes(term)) score += 3;
    if (genre.includes(term)) {
      score += 2;
      genreHit = true;
    }
    book.tags.forEach((tag, i) => {
      if (tags[i].includes(term)) {
        score += 2;
        if (!hitTags.includes(tag)) hitTags.push(tag);
      }
    });
    if (desc.includes(term)) score += 1;
  }
  // Gentle tie-breaker by quality so equal matches still rank sensibly.
  score += book.rating / 10 + book.likeCount / 100000;
  return { book, score, hitTags, genreHit };
}

function reason(s: Scored, locale: Locale): string {
  const bits: string[] = [];
  if (s.genreHit) bits.push(s.book.genre);
  if (s.hitTags.length) bits.push(s.hitTags.slice(0, 3).join(', '));
  const detail = bits.join(' · ');
  if (locale === 'de') {
    return detail
      ? `Passt zu deiner Stimmung – ${detail}.`
      : `Ein beliebter Treffer mit ${s.book.rating.toFixed(1)} Sternen.`;
  }
  return detail
    ? `Matches your mood — ${detail}.`
    : `A well-loved pick rated ${s.book.rating.toFixed(1)}.`;
}

export function localRecommend(
  query: string,
  books: Book[],
  locale: Locale,
  limit = 4,
): Recommendation[] {
  const terms = [...new Set(tokenize(query))];
  const scored = books
    .map((b) => scoreBook(b, terms))
    .sort((a, b) => b.score - a.score);

  // Strong matches first; pad with the next best-scoring books so we always
  // return a full set (a recommender that returns one book feels broken).
  const strong = scored.filter((s) => s.score >= 1.5);
  const ordered = strong.length >= limit ? strong : scored;
  const denom = terms.length * 5 || 5;

  return ordered.slice(0, limit).map((s, i) => ({
    bookId: s.book.id,
    reason: reason(s, locale),
    score:
      Math.round(
        Math.max(0.35 - i * 0.05, Math.min(1, s.score / denom)) * 100,
      ) / 100,
  }));
}
