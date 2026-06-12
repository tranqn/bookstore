/**
 * Build-time sitemap generator: static routes + one URL per seeded book.
 * Run with:  npm run sitemap   (also wired into the CI build)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookSeedSchema } from '../src/app/core/models/book.schema';
import { SITE_ORIGIN } from '../src/app/core/config/site';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../src/assets/data/books.seed.json');
const OUT = resolve(__dirname, '../public/sitemap.xml');

const STATIC_ROUTES = ['/', '/catalog', '/gallery', '/recommender', '/architecture'];

async function run(): Promise<void> {
  const seed = BookSeedSchema.parse(JSON.parse(await readFile(SEED, 'utf8')));
  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    ...STATIC_ROUTES.map((path) => ({ path, priority: path === '/' ? '1.0' : '0.8' })),
    ...seed.map((b) => ({ path: `/book/${b.id}`, priority: '0.6' })),
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          `  <url><loc>${SITE_ORIGIN}${u.path}</loc>` +
          `<lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`,
      )
      .join('\n') +
    '\n</urlset>\n';

  await writeFile(OUT, xml, 'utf8');
  console.log(`Wrote ${urls.length} URLs → ${OUT}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
