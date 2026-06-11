import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { Book, CartItem } from '../core/models/book';
import { StorageService } from '../core/services/storage';
import { CatalogStore } from './catalog.store';

interface CartState {
  items: CartItem[];
}

export interface CartLine {
  book: Book;
  qty: number;
  lineTotal: number;
}

const KEY = 'cart';

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>({ items: [] }),
  withComputed((store) => {
    const catalog = inject(CatalogStore);
    const lines = computed<CartLine[]>(() =>
      store
        .items()
        .map((item) => {
          const book = catalog.byId(item.bookId);
          return book
            ? { book, qty: item.qty, lineTotal: book.price.amount * item.qty }
            : null;
        })
        .filter((l): l is CartLine => l !== null),
    );
    return {
      lines,
      count: computed(() =>
        store.items().reduce((sum, i) => sum + i.qty, 0),
      ),
      subtotal: computed(() =>
        lines().reduce((sum, l) => sum + l.lineTotal, 0),
      ),
      isEmpty: computed(() => store.items().length === 0),
    };
  }),
  withMethods((store) => ({
    add(bookId: string, qty = 1): void {
      const items = store.items();
      const existing = items.find((i) => i.bookId === bookId);
      patchState(store, {
        items: existing
          ? items.map((i) =>
              i.bookId === bookId ? { ...i, qty: i.qty + qty } : i,
            )
          : [...items, { bookId, qty }],
      });
    },
    setQty(bookId: string, qty: number): void {
      if (qty <= 0) {
        patchState(store, {
          items: store.items().filter((i) => i.bookId !== bookId),
        });
        return;
      }
      patchState(store, {
        items: store.items().map((i) => (i.bookId === bookId ? { ...i, qty } : i)),
      });
    },
    remove(bookId: string): void {
      patchState(store, {
        items: store.items().filter((i) => i.bookId !== bookId),
      });
    },
    clear(): void {
      patchState(store, { items: [] });
    },
  })),
  withHooks({
    onInit(store) {
      const storage = inject(StorageService);
      patchState(store, { items: storage.get<CartItem[]>(KEY, []) });
      effect(() => storage.set(KEY, store.items()));
    },
  }),
);
