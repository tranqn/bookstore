# 📚 Bookstore — Stories you can touch

A bilingual (DE/EN) bookstore with a **74-book curated catalog**, built with **Angular 21**: server-side rendering, signal-based state, an interactive **Three.js 3D bookshelf**, and a **three-tier AI book recommender** (Gemini → local EmbeddingGemma → keyword fallback) behind a server-side BFF.

**🔗 Live demo:** _deploying to Render — link coming shortly_

[![CI](https://github.com/tranqn/bookstore/actions/workflows/ci.yml/badge.svg)](https://github.com/tranqn/bookstore/actions/workflows/ci.yml)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031?logo=angular)](https://angular.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

| Home (dark) | Catalog (light) |
| --- | --- |
| ![Home hero with GSAP entrance animation](docs/screenshots/home.png) | ![Catalog with search, genre filter and sorting](docs/screenshots/catalog.png) |

| 3D bookshelf (Three.js) | AI recommender |
| --- | --- |
| ![Interactive 3D book wall](docs/screenshots/gallery-3d.png) | ![Mood-based AI book recommendations](docs/screenshots/ai-recommender.png) |

## Highlights

- **Angular 21 SSR + hydration with event replay** — Express server, all routes prerendered at build time (every book detail page ships as static HTML), `withEventReplay()` so no click is lost before hydration.
- **Signal-based state management** — six `@ngrx/signals` stores (catalog with entities, cart, favorites, reviews, UI, AI) with `computed()` pipelines and localStorage persistence via effects.
- **Three-tier AI recommender** — the browser never sees an API key. Tier 1: a server-side BFF (`POST /api/recommend`) calls Gemini 2.5 Flash with the catalog as grounding context and **streams results as NDJSON** — each card zod-validated, filtered against real catalog IDs, animating in while the model thinks. Tier 2 (no key / API failure): **EmbeddingGemma 300M runs locally on the server's CPU** — book vectors precomputed at build time, queries ranked by cosine similarity, fully bilingual, ~1 s on a 2-vCPU box. Tier 3: a deterministic keyword recommender, which also runs client-side if the server is unreachable.
- **Three.js 3D bookshelf** — raycaster hover, orbit controls, genre-tinted spines, loaded via `@defer (on viewport)`; falls back to a regular grid under SSR, missing WebGL, or `prefers-reduced-motion`. Deep-linkable: `/gallery?focus=<book>` flies the camera to that book.
- **Installable PWA** — service worker with offline asset caching, update toast on new deploys (`SwUpdate`), `/api/**` explicitly excluded from caching.
- **Self-documenting** — an in-app [`/architecture`](https://bookstore-tranqn.onrender.com/architecture) page walks through the stack and engineering decisions, each card deep-linking into the source.
- **Motion that respects users** — GSAP entrance timelines + Lenis smooth scrolling, dynamically imported after hydration and fully disabled for reduced-motion users.
- **Bilingual & themeable** — Transloco (DE/EN) with persisted locale, dark/light theme on Tailwind v4 design tokens with WCAG AA contrast.
- **Typed end to end** — strict TypeScript, zod-validated seed data, no `any`.
- **Quality gates in CI** — eslint (zero warnings), Vitest unit tests, 21 Playwright E2E tests including **automated axe WCAG-AA audits of every route in both themes**, and Lighthouse budget assertions.
- **Lighthouse (desktop): 100/100/100/100 on home** — 98–99 performance on the image-heavy routes, everything else 100. Enforced continuously via Lighthouse CI.

## Architecture

```mermaid
flowchart LR
    subgraph Build time
        CB[curated-books.ts<br/>editorial layer] --> FS[fetch-seed.ts]
        OL[Open Library API] --> FS
        GB[Google Books API] --> FS
        FS -->|zod-validated| SEED[books.seed.json]
        SEED --> PRERENDER[Angular prerender<br/>all routes incl. /book/:id]
    end

    subgraph Runtime
        B[Browser<br/>Angular 21 + signals] <-->|SSR / static HTML| EX[Express server]
        B -->|POST /api/recommend| EX
        EX -->|GEMINI_API_KEY stays server-side| GEM[Gemini 2.5 Flash]
        EX -.->|no key / failure| LOCAL[local recommender<br/>deterministic fallback]
    end
```

## Engineering decisions

- **BFF instead of client-side AI calls** — the Gemini key lives only in the server environment; the client talks to `/api/recommend`. Responses are schema-validated and recommendations are filtered against real catalog IDs to guard against hallucinations.
- **Prerendering over per-request SSR** — the catalog is known at build time, so every route (including all 55+ book detail pages) is rendered to static HTML for instant first paint; Express serves static assets and the AI endpoint.
- **`@defer` for the 3D scene** — Three.js never blocks initial load; it streams in when the gallery scrolls into view, with placeholder/loading states and a non-WebGL fallback grid.
- **Editorial data + API enrichment** — book metadata is hand-curated (bilingual descriptions, pricing), while covers/ISBNs are fetched once at build time from Open Library/Google Books and validated with zod — no runtime dependency on third-party APIs for the core experience.
- **Signals everywhere, OnPush everywhere** — zero `*ngIf`/`*ngFor`, native control flow, `input()`/`computed()`, all 15+ components `OnPush`.
- **Accessibility as a requirement, not a feature** — skip link, `aria-live` result counts, focus-visible styles, reduced-motion fallbacks for every animation, WCAG AA contrast documented in the design tokens.

## Running locally

```bash
npm ci
npm start            # dev server on http://localhost:4200
```

The AI recommender works out of the box via the local fallback. To enable Gemini:

```bash
GEMINI_API_KEY=your-key npm start
```

| Script | What it does |
| --- | --- |
| `npm start` | Dev server with HMR |
| `npm run build` | Production build (SSR + prerender) |
| `npm run serve:ssr:bookstore` | Serve the production build |
| `npm run test` / `npm run test:ci` | Vitest unit tests (watch / single run) |
| `npm run e2e` | Playwright E2E + axe accessibility audits against the production build |
| `npm run lint` | angular-eslint (template a11y rules included) |
| `npm run seed` | Regenerate book seed data from Open Library/Google Books |
| `npm run optimize:covers` | Self-host covers as WebP renditions + LQIP placeholders |
| `npm run sitemap` | Regenerate `public/sitemap.xml` from the seed |

## Deployment

The production server is a single Node process (Express + SSR) with security headers (helmet), gzip, rate-limited AI endpoint, `/healthz` liveness probe and graceful shutdown.

**Docker (any VM, e.g. a GCP e2-medium):**

```bash
docker build -t bookstore .
docker run -d -p 80:4000 \
  -e NG_ALLOWED_HOSTS=your-domain.example \
  -e GEMINI_API_KEY=…            # optional — tier 2/3 work without it \
  -v hf-cache:/app/.cache/huggingface \
  bookstore
```

**Render:** one-click via [`render.yaml`](render.yaml) (Blueprint), `GEMINI_API_KEY` set in the dashboard.

| Env var | Purpose |
| --- | --- |
| `PORT` | Listen port (default `4000`) |
| `NG_ALLOWED_HOSTS` | Comma-separated hostnames for Angular's SSRF guard (your domain) |
| `GEMINI_API_KEY` | Optional — enables tier-1 streamed Gemini recommendations |
| `DISABLE_SEMANTIC` | Set to `1` to skip the local EmbeddingGemma tier (low-RAM hosts) |
| `GOOGLE_BOOKS_API_KEY` | Build-time only — raises the quota for `npm run seed` |

Data pipeline after changing the catalog: `npm run seed && npm run optimize:covers && npm run embed && npm run sitemap`.

## Project history

This is a ground-up remake of a vanilla-JS bookstore (preserved in [`legacy/`](legacy/)) — from a single static page with hardcoded data to a prerendered, bilingual, AI-assisted storefront. Same shop, two generations of frontend.

## Roadmap

- [x] Shared-element view transitions (catalog → book detail)
- [x] ⌘K command palette
- [x] Self-hosted WebP covers with LQIP placeholders + `NgOptimizedImage`
- [x] schema.org `Book` JSON-LD, Open Graph cards, sitemap
- [x] Playwright E2E + automated axe accessibility audits in CI
- [x] Streaming AI recommendations (NDJSON)
- [x] In-app "How it's built" page (`/architecture`)
- [x] Installable PWA with update toast
- [x] 3D shelf deep-linking (`/gallery?focus=…`)
- [ ] Order history with a real backend (the current checkout is intentionally a mock)

---

Built by **Quoc Nam Tran** — frontend developer (Angular/TypeScript), Germany. 🇩🇪🇬🇧
