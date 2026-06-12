import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { join } from 'node:path';
import type { Locale } from './app/core/models/book';
import { getRecommendations, streamRecommendations } from './server/recommender';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/** Angular's SSRF guard rejects unknown Host headers (and silently falls back
 *  to the CSR shell — losing prerendered HTML), so allow local dev hosts plus
 *  whatever hostname the platform reports (Render sets
 *  RENDER_EXTERNAL_HOSTNAME). Extra hosts via NG_ALLOWED_HOSTS. */
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  '*.onrender.com',
  ...(process.env['RENDER_EXTERNAL_HOSTNAME']
    ? [process.env['RENDER_EXTERNAL_HOSTNAME']]
    : []),
  ...(process.env['NG_ALLOWED_HOSTS']?.split(',') ?? []),
];
const angularApp = new AngularNodeAppEngine({ allowedHosts });

// Security headers. CSP stays off: Angular hydration relies on inline
// scripts/event-replay attributes that a strict policy would break; the
// remaining helmet defaults (nosniff, frame-deny, referrer policy, HSTS
// behind TLS) are all safe for this app.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// Behind one proxy hop in production (Render LB / nginx on the VM) so the
// rate limiter sees real client IPs from X-Forwarded-For.
app.set('trust proxy', 1);

// gzip/brotli for HTML, JS, CSS and JSON (covers are already-compressed WebP).
app.use(compression());

/** Liveness probe for load balancers / uptime monitors. */
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

/** The recommender calls a metered API — keep one client from draining it. */
const recommendLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'too many requests — try again in a minute' },
});

/**
 * AI recommender BFF. Keeps GEMINI_API_KEY server-side; degrades to a local
 * deterministic recommender when no key is configured.
 */
app.post('/api/recommend', recommendLimiter, express.json({ limit: '4kb' }), async (req, res) => {
  const body = (req.body ?? {}) as { query?: unknown; locale?: unknown };
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 280) : '';
  const locale: Locale = body.locale === 'en' ? 'en' : 'de';

  if (query.length < 2) {
    res.status(400).json({ error: 'query too short' });
    return;
  }

  // Content negotiation: NDJSON streams one card per line as the model
  // produces them; plain JSON keeps the original request/response contract.
  if (req.headers.accept?.includes('application/x-ndjson')) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no'); // no proxy buffering
    try {
      for await (const event of streamRecommendations(query, locale, 4)) {
        res.write(JSON.stringify(event) + '\n');
        res.flush?.(); // push through the compression middleware immediately
      }
    } finally {
      res.end();
    }
    return;
  }

  try {
    const { results, source } = await getRecommendations(query, locale, 4);
    res.json({ results, source });
  } catch {
    res.status(500).json({ error: 'recommendation failed' });
  }
});

/**
 * Serve static files from /browser.
 * Only build outputs carry a content hash (e.g. main-ODBXN7N6.js) and may be
 * cached forever; unhashed files from public/ (i18n, robots, covers) must
 * revalidate via ETag or deploys would serve stale copies for a year.
 */
const HASHED_ASSET = /-[A-Z0-9]{8}\.\w+$/;
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      res.setHeader(
        'Cache-Control',
        HASHED_ASSET.test(path)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      );
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);

    // Pre-load EmbeddingGemma in the background so the first recommender
    // query doesn't pay the model-load cost (first deploy also downloads it).
    if (!process.env['DISABLE_SEMANTIC']) {
      import('./server/semantic-recommender')
        .then((m) => m.warmup())
        .catch(() => {});
    }
  });

  // Graceful shutdown: finish in-flight requests, then exit (orchestrators
  // send SIGTERM on deploy/scale-down; the fallback timer guards hangs).
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
