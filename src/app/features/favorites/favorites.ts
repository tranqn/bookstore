import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { BookCard } from '../../shared/ui/book-card';
import { FavoritesStore } from '../../stores/favorites.store';

@Component({
  selector: 'app-favorites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, BookCard],
  template: `
    <section *transloco="let t" class="py-10">
      <h1 class="mb-8 text-3xl font-extrabold sm:text-4xl">
        {{ t('nav.favorites') }}
      </h1>

      @if (favorites.books().length > 0) {
        <ul class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          @for (book of favorites.books(); track book.id) {
            <li><app-book-card [book]="book" /></li>
          }
        </ul>
      } @else {
        <div class="py-20 text-center">
          <p class="text-lg text-muted">♥</p>
          <p class="mt-2 text-muted">{{ t('cart.empty') }}</p>
          <a
            routerLink="/catalog"
            class="mt-4 inline-block rounded-xl border border-white/20 px-4 py-2 text-sm transition-colors hover:accent"
          >
            {{ t('cart.continue') }}
          </a>
        </div>
      }
    </section>
  `,
})
export class Favorites {
  protected readonly favorites = inject(FavoritesStore);
}
