import { TestBed } from '@angular/core/testing';
import { CatalogStore } from './catalog.store';
import { CartStore } from './cart.store';
import { FavoritesStore } from './favorites.store';

describe('CartStore', () => {
  let catalog: InstanceType<typeof CatalogStore>;
  let cart: InstanceType<typeof CartStore>;

  beforeEach(() => {
    catalog = TestBed.inject(CatalogStore);
    cart = TestBed.inject(CartStore);
  });

  it('joins line items with the catalog and computes totals', () => {
    const book = catalog.entities()[0];
    cart.add(book.id, 2);

    expect(cart.count()).toBe(2);
    expect(cart.lines().length).toBe(1);
    expect(cart.subtotal()).toBeCloseTo(book.price.amount * 2);
  });

  it('merges quantity when the same book is added twice', () => {
    const book = catalog.entities()[0];
    cart.add(book.id);
    cart.add(book.id);
    expect(cart.count()).toBe(2);
    expect(cart.lines().length).toBe(1);
  });

  it('removes a line when quantity drops to zero', () => {
    const book = catalog.entities()[0];
    cart.add(book.id);
    cart.setQty(book.id, 0);
    expect(cart.isEmpty()).toBe(true);
  });
});

describe('FavoritesStore', () => {
  it('toggles favorite ids and resolves to catalog books', () => {
    const catalog = TestBed.inject(CatalogStore);
    const favorites = TestBed.inject(FavoritesStore);
    const book = catalog.entities()[0];

    expect(favorites.isFavorite(book.id)).toBe(false);
    favorites.toggle(book.id);
    expect(favorites.isFavorite(book.id)).toBe(true);
    expect(favorites.books()[0].id).toBe(book.id);

    favorites.toggle(book.id);
    expect(favorites.count()).toBe(0);
  });
});
