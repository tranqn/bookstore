import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { Review } from '../core/models/book';
import { PlatformService } from '../core/services/platform';
import { StorageService } from '../core/services/storage';

interface ReviewsState {
  byBook: Record<string, Review[]>;
}

const KEY = 'reviews';

export const ReviewsStore = signalStore(
  { providedIn: 'root' },
  withState<ReviewsState>({ byBook: {} }),
  withComputed((store) => ({
    total: computed(() =>
      Object.values(store.byBook()).reduce((n, list) => n + list.length, 0),
    ),
  })),
  withMethods((store) => {
    const platform = inject(PlatformService);
    return {
      forBook(bookId: string): Review[] {
        return store.byBook()[bookId] ?? [];
      },
      add(bookId: string, author: string, body: string, rating?: number): void {
        const review: Review = {
          id:
            platform.isBrowser && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          bookId,
          author: author.trim() || 'Anonym',
          body: body.trim(),
          rating,
          createdAt: new Date().toISOString(),
        };
        const current = store.byBook()[bookId] ?? [];
        patchState(store, {
          byBook: { ...store.byBook(), [bookId]: [review, ...current] },
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const storage = inject(StorageService);
      patchState(store, {
        byBook: storage.get<Record<string, Review[]>>(KEY, {}),
      });
      effect(() => storage.set(KEY, store.byBook()));
    },
  }),
);
