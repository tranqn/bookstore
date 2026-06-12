/**
 * Build-time semantic index: embeds every seeded book with EmbeddingGemma
 * and writes the vectors to src/assets/data/books.embeddings.json (imported
 * only by the server bundle — never shipped to the browser).
 *
 * Run with:  npm run embed   (after `npm run seed` / cover changes)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookSeedSchema } from '../src/app/core/models/book.schema';
import { documentPrompt, getEmbedder } from '../src/server/embeddings';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../src/assets/data/books.seed.json');
const OUT = resolve(__dirname, '../src/assets/data/books.embeddings.json');

async function run(): Promise<void> {
  const books = BookSeedSchema.parse(JSON.parse(await readFile(SEED, 'utf8')));

  console.log('Loading EmbeddingGemma (first run downloads ~300 MB)…');
  const embed = await getEmbedder();

  // One bilingual document per book so DE and EN queries both match.
  const docs = books.map((b) =>
    documentPrompt(
      b.title,
      `${b.author} · ${b.genre} · ${b.tags.join(', ')}. ` +
        `${b.description.de} ${b.description.en}`,
    ),
  );

  const started = Date.now();
  const vectors = await embed(docs);
  console.log(`Embedded ${books.length} books in ${Date.now() - started} ms`);

  const index = books.map((b, i) => ({ id: b.id, vector: vectors[i] }));
  await writeFile(OUT, JSON.stringify(index) + '\n', 'utf8');
  console.log(`Wrote ${OUT}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
