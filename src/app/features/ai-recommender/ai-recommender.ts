import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AiStore } from '../../stores/ai.store';
import { UiStore } from '../../stores/ui.store';
import { RatingStars } from '../../shared/ui/rating-stars';

@Component({
  selector: 'app-ai-recommender',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, TranslocoDirective, RatingStars],
  template: `
    <section *transloco="let t" class="mx-auto max-w-3xl py-12">
      <header class="text-center">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] accent">
          {{ t('recommender.kicker') }}
        </p>
        <h1 class="mt-2 text-3xl font-extrabold sm:text-4xl">{{ t('recommender.title') }}</h1>
        <p class="mx-auto mt-3 max-w-xl text-muted">{{ t('recommender.subtitle') }}</p>
      </header>

      <form (submit)="submit($event)" class="mt-8">
        <textarea
          [value]="text()"
          (input)="text.set($any($event.target).value)"
          rows="3"
          [placeholder]="t('recommender.placeholder')"
          class="w-full resize-y rounded-2xl border border-white/15 bg-white/5 px-5 py-4 outline-none placeholder:text-muted focus:border-coral-500"
        ></textarea>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          @for (ex of examples(); track ex) {
            <button
              type="button"
              (click)="useExample(ex)"
              class="rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted transition-colors hover:accent"
            >
              {{ ex }}
            </button>
          }
          <button
            type="submit"
            [disabled]="ai.isBusy() || text().trim().length < 2"
            class="ml-auto rounded-xl bg-coral-500 px-6 py-2.5 font-semibold text-ink-950 shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {{ ai.isBusy() ? t('recommender.thinking') : t('recommender.submit') }}
          </button>
        </div>
      </form>

      <!-- Results -->
      <div class="mt-10" aria-live="polite">
        @if (ai.isLoading()) {
          <ul class="space-y-4">
            @for (i of [1, 2, 3]; track i) {
              <li class="flex gap-4 rounded-2xl surface-raised p-4 ring-1 ring-white/10">
                <div class="h-24 w-16 shrink-0 animate-pulse rounded bg-white/10"></div>
                <div class="flex-1 space-y-2 py-1">
                  <div class="h-4 w-1/3 animate-pulse rounded bg-white/10"></div>
                  <div class="h-3 w-2/3 animate-pulse rounded bg-white/10"></div>
                  <div class="h-3 w-1/2 animate-pulse rounded bg-white/10"></div>
                </div>
              </li>
            }
          </ul>
        } @else if (ai.cards().length > 0) {
          <ul class="space-y-4">
            @for (card of ai.cards(); track card.book.id; let i = $index) {
              <li class="flex animate-rec-in gap-4 rounded-2xl surface-raised p-4 ring-1 ring-white/10">
                <a
                  [routerLink]="['/book', card.book.id]"
                  class="relative block h-24 w-16 shrink-0 overflow-hidden rounded"
                >
                  <img
                    [ngSrc]="card.book.cover.small"
                    [alt]="card.book.title"
                    fill
                    class="object-cover"
                  />
                </a>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="grid h-6 w-6 place-items-center rounded-full bg-coral-500 text-xs font-bold text-ink-950">
                      {{ i + 1 }}
                    </span>
                    <a [routerLink]="['/book', card.book.id]" class="truncate font-bold hover:accent">
                      {{ card.book.title }}
                    </a>
                  </div>
                  <p class="mt-0.5 text-sm text-muted">{{ card.book.author }}</p>
                  <p class="mt-2 text-sm leading-relaxed">“{{ card.reason }}”</p>
                  <div class="mt-2 flex items-center gap-3">
                    <app-rating-stars [value]="card.book.rating" />
                    <span class="text-xs text-muted">{{ t('recommender.match') }}: {{ (card.score * 100).toFixed(0) }}%</span>
                  </div>
                </div>
              </li>
            }
          </ul>
          @if (ai.source(); as src) {
            <p class="mt-4 text-center text-xs text-muted">
              {{ src === 'gemini' ? t('recommender.viaGemini') : t('recommender.viaLocal') }}
            </p>
          }
        } @else if (ai.status() === 'success') {
          <p class="text-center text-muted">{{ t('recommender.none') }}</p>
        }
      </div>
    </section>
  `,
})
export class AiRecommender {
  protected readonly ai = inject(AiStore);
  private readonly ui = inject(UiStore);

  protected readonly text = signal('');
  protected readonly examples = computed(() =>
    this.ui.locale() === 'de'
      ? ['etwas Spannendes für eine Zugfahrt', 'verträumte Fantasy', 'klüger werden']
      : ['a gripping thriller for a flight', 'cosy fantasy', 'help me think clearer'],
  );

  protected submit(e: Event): void {
    e.preventDefault();
    void this.ai.recommend(this.text());
  }

  protected useExample(ex: string): void {
    this.text.set(ex);
    void this.ai.recommend(ex);
  }
}
