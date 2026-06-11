import type { Book, Locale, Recommendation } from '../app/core/models/book';
import { localRecommend } from '../app/core/ai/local-recommender';
import seed from '../assets/data/books.seed.json';

const books = seed as Book[];
const validIds = new Set(books.map((b) => b.id));

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bookId: { type: 'string' },
          reason: { type: 'string' },
          score: { type: 'number' },
        },
        required: ['bookId', 'reason', 'score'],
      },
    },
  },
  required: ['results'],
};

async function gemini(
  query: string,
  locale: Locale,
  limit: number,
): Promise<Recommendation[] | null> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) return null;

  // Lazy import keeps the AI SDK out of the SSR bundle's hot path.
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  // Compact catalog as grounding context — only the fields the model needs.
  const catalog = books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    genre: b.genre,
    tags: b.tags,
    description: b.description[locale],
  }));

  const lang = locale === 'de' ? 'German' : 'English';
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `A reader describes their mood: "${query}". Recommend ${limit} books from the catalog that best fit, ranked best-first. Write each reason in ${lang}, max 18 words.`,
    config: {
      systemInstruction:
        `You are a thoughtful bookshop recommender. You may ONLY recommend books ` +
        `from this catalog and must use their exact "id" values. Score is 0..1 ` +
        `(fit to the mood). Catalog JSON:\n${JSON.stringify(catalog)}`,
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
    },
  });

  const raw = res.text;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { results?: Recommendation[] };

  // Drop hallucinated ids; keep order; clamp to limit.
  const cleaned = (parsed.results ?? [])
    .filter((r) => r && validIds.has(r.bookId))
    .slice(0, limit)
    .map((r) => ({
      bookId: r.bookId,
      reason: String(r.reason ?? '').slice(0, 240),
      score: Math.max(0, Math.min(1, Number(r.score) || 0)),
    }));

  return cleaned.length > 0 ? cleaned : null;
}

/** Try Gemini; fall back to the deterministic local recommender on any miss. */
export async function getRecommendations(
  query: string,
  locale: Locale,
  limit = 4,
): Promise<{ results: Recommendation[]; source: 'gemini' | 'local' }> {
  try {
    const ai = await gemini(query, locale, limit);
    if (ai) return { results: ai, source: 'gemini' };
  } catch {
    /* fall through to local */
  }
  return { results: localRecommend(query, books, locale, limit), source: 'local' };
}
