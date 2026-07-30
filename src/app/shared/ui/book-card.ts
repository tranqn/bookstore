import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import type { Book } from '../../core/models/book';
import { ViewTransitionService } from '../../core/services/view-transition';
import { formatMoney } from '../../core/util/format';
import { CartStore } from '../../stores/cart.store';
import { FavoritesStore } from '../../stores/favorites.store';
import { UiStore } from '../../stores/ui.store';
import { RatingStars } from './rating-stars';

/** Product tile in the thalia.de mould: the cover sits *contained* on a light
 *  panel (never cropped, like a book on a shelf), the metadata reads top-down
 *  as format → title → author → rating → availability, and the price row with
 *  the basket button anchors the bottom so tiles line up across a row.
 *
 *  The card is an <article>, not an <a>: the title link stretches over the
 *  whole tile via `after:inset-0`, which keeps the basket and wishlist buttons
 *  as valid, separately focusable controls. */
@Component({
  selector: 'app-book-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, TranslocoDirective, RatingStars],
  host: { class: 'block h-full' },
  template: `
    <article
      *transloco="let t"
      class="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] surface-raised shadow-md transition-[transform,box-shadow,border-color] duration-300 will-change-transform hover:-translate-y-1 hover:border-coral-500/50 hover:shadow-xl focus-within:-translate-y-1"
    >
      <div class="relative cover-panel px-5 pb-4 pt-5">
        <div class="relative mx-auto aspect-2/3 w-3/5 min-w-20">
          <img
            [ngSrc]="book().cover.medium"
            [alt]="book().title"
            fill
            [priority]="priority()"
            [placeholder]="book().cover.lqip ?? false"
            [style.view-transition-name]="
              viewTransition.activeBookId() === book().id ? 'book-cover' : null
            "
            class="rounded-[3px] object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/0.35)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-[1.03]"
          />
        </div>

        <button
          type="button"
          (click)="toggleFavorite()"
          [attr.aria-pressed]="isFavorite()"
          [attr.aria-label]="
            (isFavorite() ? t('detail.liked') : t('detail.like')) + ': ' + book().title
          "
          class="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-ink-950/70 text-base backdrop-blur transition-colors hover:bg-ink-950/90"
          [class]="isFavorite() ? 'text-coral-400' : 'text-white'"
        >
          <span aria-hidden="true">{{ isFavorite() ? '♥' : '♡' }}</span>
        </button>
      </div>

      <div class="flex flex-1 flex-col px-4 pb-4 pt-3">
        <p class="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">
          {{ t('card.format') }} · {{ book().genre }}
        </p>

        <h3 class="mt-1 line-clamp-2 text-sm font-bold leading-snug sm:text-base">
          <a
            [routerLink]="['/book', book().id]"
            (click)="markTransitionSource()"
            class="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {{ book().title }}
          </a>
        </h3>
        <p class="mt-0.5 line-clamp-1 text-sm text-muted">{{ book().author }}</p>

        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <app-rating-stars [value]="book().rating" />
          <span class="text-xs text-muted">
            <span aria-hidden="true">♡ {{ book().likeCount }}</span>
            <span class="sr-only">{{ book().likeCount }} {{ t('card.likes') }}</span>
          </span>
        </div>

        <p class="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ok">
          <span aria-hidden="true" class="size-1.5 rounded-full bg-current"></span>
          {{ t('card.available') }}
        </p>

        <div class="mt-auto flex items-end justify-between gap-2 pt-3">
          <span class="text-lg font-extrabold accent">{{ price() }}</span>
          <button
            type="button"
            (click)="addToCart()"
            [attr.aria-label]="t('detail.addToCart') + ': ' + book().title"
            class="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-coral-500 text-ink-950 transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-5"
              aria-hidden="true"
            >
              <path d="M3 5h2.2l2.3 9.7a2 2 0 0 0 1.95 1.55h6.9a2 2 0 0 0 1.95-1.5L20 8H6" />
              <circle cx="10" cy="20" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="17" cy="20" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  `,
})
export class BookCard {
  private readonly ui = inject(UiStore);
  private readonly cart = inject(CartStore);
  private readonly favorites = inject(FavoritesStore);
  protected readonly viewTransition = inject(ViewTransitionService);
  readonly book = input.required<Book>();
  /** Above-the-fold cards preload their cover (LCP). */
  readonly priority = input(false);
  protected readonly price = computed(() => formatMoney(this.book().price, this.ui.locale()));
  protected readonly isFavorite = computed(() => this.favorites.isFavorite(this.book().id));

  /** Tag this card's cover as the morph source before the route changes. */
  protected markTransitionSource(): void {
    this.viewTransition.activeBookId.set(this.book().id);
  }

  protected addToCart(): void {
    this.cart.add(this.book().id);
    this.ui.openCart();
  }

  protected toggleFavorite(): void {
    this.favorites.toggle(this.book().id);
  }
}
