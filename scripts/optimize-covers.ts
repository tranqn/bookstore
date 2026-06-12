/**
 * Cover self-hosting pipeline. Downloads each cover referenced in
 * src/assets/data/books.seed.json once, re-encodes it as WebP at three widths
 * into public/covers/, embeds a base64 LQIP placeholder plus intrinsic
 * dimensions, and rewrites the seed to the local paths. After this runs the
 * app has no runtime dependency on Open Library / Google Books.
 *
 * Run with:  npm run optimize:covers   (idempotent — skips local covers)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BookSeedSchema, type BookSeed } from '../src/app/core/models/book.schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../src/assets/data/books.seed.json');
const OUT_DIR = resolve(__dirname, '../public/covers');
const UA = 'bookstore-portfolio/1.0 (cover-optimizer)';

/** width → file suffix; `small` thumbs, `medium` cards, `large` detail hero */
const SIZES = [
  { key: 'small', width: 96 },
  { key: 'medium', width: 320 },
  { key: 'large', width: 640 },
] as const;
const LQIP_WIDTH = 16;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  // Open Library returns a 1×1 pixel for missing sizes — treat as failure.
  return buf.byteLength > 1000 ? buf : null;
}

async function run(): Promise<void> {
  const seed = BookSeedSchema.parse(
    JSON.parse(await readFile(SEED, 'utf8')),
  ) as BookSeed;
  await mkdir(OUT_DIR, { recursive: true });

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of seed) {
    if (book.cover.large.startsWith('/covers/')) {
      skipped++;
      continue;
    }

    const source =
      (await download(book.cover.large).catch(() => null)) ??
      (await download(book.cover.medium).catch(() => null));
    if (!source) {
      failed++;
      console.warn(`  ⚠ could not fetch cover for "${book.title}" — kept remote URL`);
      continue;
    }

    const image = sharp(source).rotate();
    const meta = await image.metadata();

    for (const { key, width } of SIZES) {
      const out = resolve(OUT_DIR, `${book.id}-${width}.webp`);
      await image
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: key === 'large' ? 82 : 78 })
        .toFile(out);
      book.cover[key] = `/covers/${book.id}-${width}.webp`;
    }

    const lqip = await image
      .clone()
      .resize({ width: LQIP_WIDTH })
      .webp({ quality: 30 })
      .toBuffer();
    book.cover.lqip = `data:image/webp;base64,${lqip.toString('base64')}`;

    // Intrinsic ratio at the largest emitted width (no CLS in prerendered HTML).
    const scale = Math.min(1, 640 / (meta.width ?? 640));
    book.cover.width = Math.round((meta.width ?? 640) * scale);
    book.cover.height = Math.round((meta.height ?? 960) * scale);

    converted++;
    console.log(`  ✓ ${book.title} (${book.cover.width}×${book.cover.height})`);
    await sleep(150);
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.log(
    `\nRewrote ${SEED}` +
      `\n  converted: ${converted}\n  already local: ${skipped}\n  failed: ${failed}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
