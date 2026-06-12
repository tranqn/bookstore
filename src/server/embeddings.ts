/**
 * Shared embedding helpers for the semantic recommender — used by the
 * build-time indexer (scripts/embed-books.ts) and the runtime query path.
 *
 * Model: EmbeddingGemma 300M (Gemma/Gemini family) via transformers.js ONNX,
 * int8-quantized: ~300 MB RAM, CPU-only, fits an e2-medium next to the SSR
 * process. Vectors are Matryoshka-truncated 768 → 256 dims and renormalized,
 * which keeps the committed index small with negligible quality loss.
 */

export const EMBEDDING_MODEL = 'onnx-community/embeddinggemma-300m-ONNX';
export const EMBEDDING_DIMS = 256;

/** EmbeddingGemma prompt formats (asymmetric retrieval). */
export const queryPrompt = (text: string): string =>
  `task: search result | query: ${text}`;
export const documentPrompt = (title: string, text: string): string =>
  `title: ${title} | text: ${text}`;

type Embedder = (texts: string[]) => Promise<number[][]>;

let embedderPromise: Promise<Embedder> | null = null;

/** Lazily loads the pipeline once per process (first call downloads the
 *  model to the HF cache; subsequent calls are ~50 ms per query on CPU). */
export function getEmbedder(): Promise<Embedder> {
  embedderPromise ??= (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, {
      dtype: 'q8',
    });
    return async (texts: string[]) => {
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      const full = output.tolist() as number[][];
      return full.map(truncateAndRenormalize);
    };
  })();
  return embedderPromise;
}

function truncateAndRenormalize(vector: number[]): number[] {
  const head = vector.slice(0, EMBEDDING_DIMS);
  const norm = Math.hypot(...head) || 1;
  return head.map((v) => Math.round((v / norm) * 1e5) / 1e5);
}

/** Both inputs are L2-normalized, so the dot product is cosine similarity. */
export function cosine(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
