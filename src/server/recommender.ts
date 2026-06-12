import { z } from 'zod';
import type { Book, Locale, Recommendation } from '../app/core/models/book';
import { localRecommend } from '../app/core/ai/local-recommender';
import seed from '../assets/data/books.seed.json';

const books = seed as Book[];
const validIds = new Set(books.map((b) => b.id));

export type RecommendSource = 'gemini' | 'semantic' | 'local';

/** One NDJSON line of the streaming protocol. */
export type RecommendEvent =
  | { type: 'rec'; bookId: string; reason: string; score: number }
  | { type: 'done'; source: RecommendSource };

/** Tier 2: local EmbeddingGemma. Skipped in unit tests (model download) and
 *  optionally on hosts that can't spare the RAM (DISABLE_SEMANTIC=1). */
async function trySemantic(
  query: string,
  locale: Locale,
  limit: number,
): Promise<Recommendation[] | null> {
  if (process.env['VITEST'] || process.env['DISABLE_SEMANTIC']) return null;
  try {
    const { semanticRecommend } = await import('./semantic-recommender');
    const results = await semanticRecommend(query, books, locale, limit);
    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

const RecLineSchema = z.object({
  bookId: z.string(),
  reason: z.string(),
  score: z.number(),
});

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

/** Streaming variant: yields one validated recommendation per NDJSON line as
 *  Gemini produces them, so the UI can render cards while the model thinks.
 *  Falls back to (instant) local results when no key is set or nothing valid
 *  arrives. */
export async function* streamRecommendations(
  query: string,
  locale: Locale,
  limit = 4,
): AsyncGenerator<RecommendEvent> {
  let emitted = 0;
  const seen = new Set<string>();

  try {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (apiKey) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const catalog = books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        genre: b.genre,
        tags: b.tags,
        description: b.description[locale],
      }));
      const lang = locale === 'de' ? 'German' : 'English';

      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: `A reader describes their mood: "${query}". Recommend ${limit} books from the catalog that best fit, ranked best-first. Write each reason in ${lang}, max 18 words.`,
        config: {
          systemInstruction:
            `You are a thoughtful bookshop recommender. You may ONLY recommend books ` +
            `from this catalog and must use their exact "id" values. Score is 0..1. ` +
            `Output NDJSON: one standalone JSON object per line, shaped ` +
            `{"bookId":"…","reason":"…","score":0.9} — no markdown, no array, no fences. ` +
            `Catalog JSON:\n${JSON.stringify(catalog)}`,
          temperature: 0.7,
        },
      });

      let buffer = '';
      for await (const chunk of stream) {
        buffer += chunk.text ?? '';
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0 && emitted < limit) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          const rec = parseRecLine(line, seen);
          if (rec) {
            emitted++;
            yield { type: 'rec', ...rec };
          }
        }
        if (emitted >= limit) break;
      }
      // Flush a trailing line without newline.
      if (emitted < limit) {
        const rec = parseRecLine(buffer.trim(), seen);
        if (rec) {
          emitted++;
          yield { type: 'rec', ...rec };
        }
      }
    }
  } catch {
    /* fall through to local */
  }

  if (emitted === 0) {
    const semantic = await trySemantic(query, locale, limit);
    for (const r of semantic ?? localRecommend(query, books, locale, limit)) {
      yield { type: 'rec', ...r };
    }
    yield { type: 'done', source: semantic ? 'semantic' : 'local' };
    return;
  }
  yield { type: 'done', source: 'gemini' };
}

function parseRecLine(
  line: string,
  seen: Set<string>,
): Recommendation | null {
  if (!line.startsWith('{')) return null;
  try {
    const parsed = RecLineSchema.safeParse(JSON.parse(line));
    if (!parsed.success) return null;
    const { bookId, reason, score } = parsed.data;
    if (!validIds.has(bookId) || seen.has(bookId)) return null;
    seen.add(bookId);
    return {
      bookId,
      reason: reason.slice(0, 240),
      score: Math.max(0, Math.min(1, score)),
    };
  } catch {
    return null;
  }
}

/** Three-tier cascade: Gemini API → local EmbeddingGemma (semantic) →
 *  deterministic keyword recommender. Each tier degrades gracefully. */
export async function getRecommendations(
  query: string,
  locale: Locale,
  limit = 4,
): Promise<{ results: Recommendation[]; source: RecommendSource }> {
  try {
    const ai = await gemini(query, locale, limit);
    if (ai) return { results: ai, source: 'gemini' };
  } catch {
    /* fall through */
  }
  const semantic = await trySemantic(query, locale, limit);
  if (semantic) return { results: semantic, source: 'semantic' };
  return { results: localRecommend(query, books, locale, limit), source: 'local' };
}
