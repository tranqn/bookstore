import type { Book, Locale, Recommendation } from '../app/core/models/book';
import { cosine, getEmbedder, queryPrompt } from './embeddings';
import index from '../assets/data/books.embeddings.json';

/**
 * Local semantic recommender — EmbeddingGemma on the server's CPU, no API.
 * Book vectors are precomputed at build time (scripts/embed-books.ts); at
 * runtime only the query is embedded (~50 ms after warm-up), then ranked by
 * cosine similarity. "verträumte Fantasy" finds Momo without sharing a
 * single keyword.
 */

const vectorsById = new Map(
  (index as { id: string; vector: number[] }[]).map((e) => [e.id, e.vector]),
);

function reason(book: Book, locale: Locale): string {
  const detail = [book.genre, ...book.tags.slice(0, 2)].join(' · ');
  return locale === 'de'
    ? `Inhaltlich nah an deiner Stimmung – ${detail}.`
    : `Semantically close to your mood — ${detail}.`;
}

export async function semanticRecommend(
  query: string,
  books: Book[],
  locale: Locale,
  limit = 4,
): Promise<Recommendation[]> {
  const embed = await getEmbedder();
  const [queryVector] = await embed([queryPrompt(query)]);

  return books
    .map((book) => ({
      book,
      similarity: cosine(queryVector, vectorsById.get(book.id) ?? []),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(({ book, similarity }) => ({
      bookId: book.id,
      reason: reason(book, locale),
      // Cosine on this model/corpus lives roughly in 0.25–0.65; stretch it
      // into a friendlier 0–1 match score.
      score: Math.round(Math.max(0.2, Math.min(1, (similarity - 0.2) / 0.4)) * 100) / 100,
    }));
}

/** Loads the model and runs one inference so the first real query is fast.
 *  Fire-and-forget at server start; failures just mean tier 3 takes over. */
export function warmup(): void {
  void getEmbedder()
    .then((embed) => embed([queryPrompt('warmup')]))
    .catch(() => {});
}
