import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { Book } from '../core/models/book';
import { StorageService } from '../core/services/storage';
import { CatalogStore } from './catalog.store';

interface FavoritesState {
  ids: string[];
}

const KEY = 'favorites';

export const FavoritesStore = signalStore(
  { providedIn: 'root' },
  withState<FavoritesState>({ ids: [] }),
  withComputed((store) => {
    const catalog = inject(CatalogStore);
    return {
      count: computed(() => store.ids().length),
      books: computed<Book[]>(() =>
        store
          .ids()
          .map((id) => catalog.byId(id))
          .filter((b): b is Book => b !== undefined),
      ),
    };
  }),
  withMethods((store) => ({
    isFavorite(id: string): boolean {
      return store.ids().includes(id);
    },
    toggle(id: string): void {
      const ids = store.ids();
      patchState(store, {
        ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      });
    },
  })),
  withHooks({
    onInit(store) {
      const storage = inject(StorageService);
      patchState(store, { ids: storage.get<string[]>(KEY, []) });
      effect(() => storage.set(KEY, store.ids()));
    },
  }),
);
