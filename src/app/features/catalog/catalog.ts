import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import type { Genre } from '../../core/models/book';
import { PlatformService } from '../../core/services/platform';
import { BookCard } from '../../shared/ui/book-card';
import {
  CatalogStore,
  type SortKey,
} from '../../stores/catalog.store';

const SORT_KEYS: SortKey[] = [
  'relevance',
  'price-asc',
  'price-desc',
  'year-desc',
  'rating-desc',
];

@Component({
  selector: 'app-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, BookCard],
  template: `
    <section *transloco="let t" class="py-10">
      <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 class="text-3xl font-extrabold sm:text-4xl">{{ t('catalog.title') }}</h1>
        <p class="text-sm text-muted" aria-live="polite">
          {{ t('catalog.results', { count: store.resultCount() }) }}
        </p>
      </header>

      <!-- Toolbar -->
      <div class="mb-8 flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <label class="relative flex-1 min-w-[220px]">
            <span class="sr-only">{{ t('catalog.searchPlaceholder') }}</span>
            <input
              type="search"
              [value]="store.search()"
              (input)="onSearch($event)"
              [placeholder]="t('catalog.searchPlaceholder')"
              class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-coral-500"
            />
          </label>

          <label class="flex items-center gap-2 text-sm">
            <span class="text-muted">{{ t('catalog.sortLabel') }}</span>
            <select
              [value]="store.sort()"
              (change)="onSort($event)"
              class="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-coral-500"
            >
              @for (key of sortKeys; track key) {
                <option [value]="key" class="text-ink-950">
                  {{ t('catalog.sort.' + key) }}
                </option>
              }
            </select>
          </label>
        </div>

        <!-- Genre chips -->
        <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="t('catalog.title')">
          <button
            type="button"
            (click)="onGenre('all')"
            [attr.aria-pressed]="store.genre() === 'all'"
            class="rounded-full border px-3 py-1.5 text-sm transition-colors"
            [class]="chipClass(store.genre() === 'all')"
          >
            {{ t('catalog.all') }}
          </button>
          @for (g of store.genres(); track g) {
            <button
              type="button"
              (click)="onGenre(g)"
              [attr.aria-pressed]="store.genre() === g"
              class="rounded-full border px-3 py-1.5 text-sm transition-colors"
              [class]="chipClass(store.genre() === g)"
            >
              {{ g }}
            </button>
          }
        </div>
      </div>

      <!-- Grid -->
      @if (store.resultCount() > 0) {
        <ul
          class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          @for (book of store.filtered(); track book.id; let i = $index) {
            <li><app-book-card [book]="book" [priority]="i < 5" /></li>
          }
        </ul>
      } @else {
        <div class="py-20 text-center">
          <p class="text-lg text-muted">{{ t('catalog.noResults') }}</p>
          <button
            type="button"
            (click)="clear()"
            class="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm transition-colors hover:accent"
          >
            {{ t('catalog.clear') }}
          </button>
        </div>
      }
    </section>
  `,
})
export class Catalog {
  protected readonly store = inject(CatalogStore);
  protected readonly sortKeys = SORT_KEYS;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platform = inject(PlatformService);

  constructor() {
    // Seed filter state from the URL once (deep links / shared filters).
    const qp = this.route.snapshot.queryParamMap;
    this.store.applyParams({
      search: qp.get('q') ?? '',
      genre: (qp.get('genre') as Genre | 'all') ?? 'all',
      sort: (qp.get('sort') as SortKey) ?? 'relevance',
    });

    // Mirror store → URL (replaceUrl, browser only — avoids SSR nav churn).
    effect(() => {
      const search = this.store.search();
      const genre = this.store.genre();
      const sort = this.store.sort();
      if (!this.platform.isBrowser) return;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          q: search || null,
          genre: genre === 'all' ? null : genre,
          sort: sort === 'relevance' ? null : sort,
        },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  protected onSearch(e: Event): void {
    this.store.setSearch((e.target as HTMLInputElement).value);
  }
  protected onSort(e: Event): void {
    this.store.setSort((e.target as HTMLSelectElement).value as SortKey);
  }
  protected onGenre(genre: Genre | 'all'): void {
    this.store.setGenre(genre);
  }
  protected chipClass(active: boolean): string {
    return active ? 'border-coral-500 accent' : 'border-white/15';
  }
  protected clear(): void {
    this.store.reset();
  }
}
