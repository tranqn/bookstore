import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import type { Locale } from '../../core/models/book';
import { UiStore } from '../../stores/ui.store';

const REPO = 'https://github.com/tranqn/bookstore/blob/bookstore';

interface DecisionCard {
  icon: string;
  title: Record<Locale, string>;
  body: Record<Locale, string>;
  file: string;
}

/** Recruiter-facing tour of the codebase: stack, data flow and the
 *  engineering decisions behind it, each deep-linking into the source. */
@Component({
  selector: 'app-architecture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  template: `
    <section *transloco="let t" class="mx-auto max-w-4xl py-12">
      <header class="text-center">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] accent">
          {{ t('arch.kicker') }}
        </p>
        <h1 class="mt-2 text-3xl font-extrabold sm:text-4xl">{{ t('arch.title') }}</h1>
        <p class="mx-auto mt-3 max-w-2xl text-muted">{{ t('arch.subtitle') }}</p>
      </header>

      <!-- Data flow -->
      <h2 class="mt-14 text-xl font-bold">{{ t('arch.flowTitle') }}</h2>
      <div class="mt-5 grid gap-3 text-sm sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div class="rounded-2xl surface-raised p-4 text-center ring-1 ring-white/10">
          <p class="text-2xl" aria-hidden="true">🖥️</p>
          <p class="mt-1 font-bold">{{ t('arch.flow.browser') }}</p>
          <p class="mt-1 text-xs text-muted">Angular 21 · Signals · Hydration</p>
        </div>
        <div class="grid place-items-center text-xl text-muted" aria-hidden="true">⇄</div>
        <div class="rounded-2xl surface-raised p-4 text-center ring-1 ring-white/10">
          <p class="text-2xl" aria-hidden="true">🚂</p>
          <p class="mt-1 font-bold">Express SSR</p>
          <p class="mt-1 text-xs text-muted">{{ t('arch.flow.server') }}</p>
        </div>
        <div class="grid place-items-center text-xl text-muted" aria-hidden="true">⇄</div>
        <div class="rounded-2xl surface-raised p-4 text-center ring-1 ring-white/10">
          <p class="text-2xl" aria-hidden="true">✨</p>
          <p class="mt-1 font-bold">Gemini 2.5 Flash</p>
          <p class="mt-1 text-xs text-muted">{{ t('arch.flow.ai') }}</p>
        </div>
      </div>
      <p class="mt-3 text-center text-xs text-muted">{{ t('arch.flow.note') }}</p>

      <!-- Stack -->
      <h2 class="mt-14 text-xl font-bold">{{ t('arch.stackTitle') }}</h2>
      <ul class="mt-5 flex flex-wrap gap-2 text-sm">
        @for (item of stack; track item) {
          <li class="rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
            {{ item }}
          </li>
        }
      </ul>

      <!-- Decisions -->
      <h2 class="mt-14 text-xl font-bold">{{ t('arch.decisionsTitle') }}</h2>
      <ul class="mt-5 grid gap-4 sm:grid-cols-2">
        @for (card of localizedCards(); track card.file) {
          <li class="flex flex-col rounded-2xl surface-raised p-5 ring-1 ring-white/10">
            <p class="text-2xl" aria-hidden="true">{{ card.icon }}</p>
            <h3 class="mt-2 font-bold">{{ card.title }}</h3>
            <p class="mt-2 flex-1 text-sm leading-relaxed text-muted">{{ card.body }}</p>
            <a
              [href]="card.href"
              target="_blank"
              rel="noopener"
              class="mt-4 text-sm font-semibold accent hover:underline"
            >
              {{ t('arch.viewSource') }} →
            </a>
          </li>
        }
      </ul>

      <p class="mt-14 text-center">
        <a
          href="https://github.com/tranqn/bookstore"
          target="_blank"
          rel="noopener"
          class="inline-block rounded-xl border border-white/20 px-6 py-3 font-semibold transition-colors hover:accent"
        >
          {{ t('arch.repo') }}
        </a>
      </p>
    </section>
  `,
})
export class Architecture {
  private readonly ui = inject(UiStore);

  protected readonly stack = [
    'Angular 21',
    'SSR + Prerendering',
    '@ngrx/signals',
    'Three.js',
    'GSAP + Lenis',
    'Tailwind CSS 4',
    'Transloco (DE/EN)',
    'Gemini BFF',
    'zod',
    'Vitest',
    'Playwright + axe',
    'Lighthouse CI',
  ];

  private readonly cards: DecisionCard[] = [
    {
      icon: '🔐',
      title: {
        de: 'BFF statt Client-seitiger KI',
        en: 'BFF instead of client-side AI',
      },
      body: {
        de: 'Drei Stufen: Gemini streamt NDJSON (zod-validiert, halluzinierte IDs verworfen) → ohne API-Key rankt ein lokales EmbeddingGemma semantisch auf der Server-CPU → notfalls ein deterministischer Keyword-Recommender.',
        en: 'Three tiers: Gemini streams NDJSON (zod-validated, hallucinated ids dropped) → without an API key a local EmbeddingGemma ranks semantically on the server CPU → a deterministic keyword recommender as the last resort.',
      },
      file: 'src/server/recommender.ts',
    },
    {
      icon: '⚡',
      title: {
        de: 'Prerendering statt SSR pro Request',
        en: 'Prerendering over per-request SSR',
      },
      body: {
        de: 'Der Katalog ist zur Build-Zeit bekannt: Jede Route — inklusive aller Buchseiten samt JSON-LD — wird als statisches HTML ausgeliefert.',
        en: 'The catalog is known at build time: every route — including all book pages with their JSON-LD — ships as static HTML.',
      },
      file: 'src/app/app.routes.server.ts',
    },
    {
      icon: '🧊',
      title: {
        de: '3D hinter @defer',
        en: '3D behind @defer',
      },
      body: {
        de: 'Three.js lädt erst, wenn das Regal in den Viewport scrollt — mit Grid-Fallback für SSR, fehlendes WebGL und reduzierte Bewegung.',
        en: 'Three.js only loads when the shelf scrolls into view — with a grid fallback for SSR, missing WebGL and reduced motion.',
      },
      file: 'src/app/features/gallery3d/gallery3d.ts',
    },
    {
      icon: '🖼️',
      title: {
        de: 'Selbst gehostete Cover + LQIP',
        en: 'Self-hosted covers + LQIP',
      },
      body: {
        de: 'Ein Build-Skript lädt jedes Cover einmal, erzeugt WebP in drei Größen plus Blur-Platzhalter — keine Laufzeit-Abhängigkeit von Dritt-APIs.',
        en: 'A build script downloads each cover once and emits three WebP sizes plus blur placeholders — zero runtime dependency on third-party APIs.',
      },
      file: 'scripts/optimize-covers.ts',
    },
    {
      icon: '📦',
      title: {
        de: 'Signal Stores für den Zustand',
        en: 'Signal stores for state',
      },
      body: {
        de: 'Sechs @ngrx/signals-Stores (Katalog mit Entities, Warenkorb, Favoriten, Rezensionen, UI, KI) mit computed-Pipelines und localStorage-Persistenz über Effects.',
        en: 'Six @ngrx/signals stores (catalog with entities, cart, favorites, reviews, UI, AI) with computed pipelines and localStorage persistence via effects.',
      },
      file: 'src/app/stores/catalog.store.ts',
    },
    {
      icon: '♿',
      title: {
        de: 'Barrierefreiheit als CI-Gate',
        en: 'Accessibility as a CI gate',
      },
      body: {
        de: 'Playwright fährt axe-Audits (WCAG AA) über jede Route in beiden Themes — zusätzlich zu Skip-Link, aria-live, Fokus-Stilen und Reduced-Motion-Fallbacks.',
        en: 'Playwright runs axe audits (WCAG AA) over every route in both themes — on top of skip link, aria-live, focus styles and reduced-motion fallbacks.',
      },
      file: 'e2e/a11y.spec.ts',
    },
  ];

  protected readonly localizedCards = computed(() => {
    const locale = this.ui.locale();
    return this.cards.map((c) => ({
      icon: c.icon,
      title: c.title[locale],
      body: c.body[locale],
      file: c.file,
      href: `${REPO}/${c.file}`,
    }));
  });
}
