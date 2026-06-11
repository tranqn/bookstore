import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { withEntities, setAllEntities } from '@ngrx/signals/entities';
import type { Book, Genre } from '../core/models/book';
import seed from '../../assets/data/books.seed.json';

export type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'year-desc' | 'rating-desc';

interface FilterState {
  search: string;
  genre: Genre | 'all';
  sort: SortKey;
}

const books = seed as Book[];

const matches = (b: Book, q: string): boolean => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    b.title.toLowerCase().includes(needle) ||
    b.author.toLowerCase().includes(needle) ||
    b.tags.some((t) => t.toLowerCase().includes(needle))
  );
};

const sorters: Record<SortKey, (a: Book, b: Book) => number> = {
  relevance: (a, b) => b.likeCount - a.likeCount,
  'price-asc': (a, b) => a.price.amount - b.price.amount,
  'price-desc': (a, b) => b.price.amount - a.price.amount,
  'year-desc': (a, b) => b.publishedYear - a.publishedYear,
  'rating-desc': (a, b) => b.rating - a.rating,
};

export const CatalogStore = signalStore(
  { providedIn: 'root' },
  withEntities<Book>(),
  withState<FilterState>({ search: '', genre: 'all', sort: 'relevance' }),
  withComputed((store) => ({
    genres: computed<Genre[]>(() => {
      const set = new Set<Genre>();
      for (const b of store.entities()) set.add(b.genre);
      return [...set].sort();
    }),
    filtered: computed<Book[]>(() => {
      const q = store.search();
      const genre = store.genre();
      return store
        .entities()
        .filter((b) => (genre === 'all' || b.genre === genre) && matches(b, q))
        .sort(sorters[store.sort()]);
    }),
    total: computed(() => store.entities().length),
  })),
  withComputed((store) => ({
    resultCount: computed(() => store.filtered().length),
    isFiltered: computed(
      () => store.search() !== '' || store.genre() !== 'all',
    ),
  })),
  withMethods((store) => ({
    setSearch(search: string): void {
      patchState(store, { search });
    },
    setGenre(genre: Genre | 'all'): void {
      patchState(store, { genre });
    },
    setSort(sort: SortKey): void {
      patchState(store, { sort });
    },
    /** Apply filter state coming from the URL in one shot (no intermediate emits). */
    applyParams(params: Partial<FilterState>): void {
      patchState(store, params);
    },
    reset(): void {
      patchState(store, { search: '', genre: 'all', sort: 'relevance' });
    },
    byId(id: string): Book | undefined {
      return store.entityMap()[id];
    },
  })),
  withHooks({
    onInit(store) {
      // Seed is static + committed, so populate eagerly (works under SSR too).
      patchState(store, setAllEntities(books));
    },
  }),
);
