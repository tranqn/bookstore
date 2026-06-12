import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { UiStore } from '../../stores/ui.store';
import { CartStore } from '../../stores/cart.store';
import { FavoritesStore } from '../../stores/favorites.store';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslocoDirective],
  host: { class: 'block sticky top-0 z-40' },
  template: `
    <header
      *transloco="let t"
      class="surface/0 flex items-center gap-4 px-4 py-3 backdrop-blur-md sm:px-6"
      style="background: color-mix(in srgb, var(--surface) 72%, transparent)"
    >
      <a
        routerLink="/"
        class="flex items-center gap-2 text-lg font-bold tracking-tight"
      >
        <img src="/logo-56.webp" alt="" width="28" height="28" class="rounded" />
        <span>{{ t('brand') }}</span>
      </a>

      <nav class="ml-2 hidden items-center gap-1 text-sm md:flex">
        @for (link of links; track link.path) {
          <a
            [routerLink]="link.path"
            routerLinkActive="accent"
            [routerLinkActiveOptions]="{ exact: link.path === '/' }"
            class="rounded-lg px-3 py-2 text-muted transition-colors hover:accent"
          >
            {{ t(link.label) }}
          </a>
        }
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          (click)="ui.openPalette()"
          [attr.aria-label]="t('palette.title') + ' — ⌘K'"
          class="hidden items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-muted transition-colors hover:accent sm:flex"
        >
          <span aria-hidden="true">⌕</span>
          <kbd class="rounded border border-white/20 px-1 text-xs">⌘K</kbd>
        </button>
        <a
          routerLink="/favorites"
          routerLinkActive="accent"
          [attr.aria-label]="t('nav.favorites')"
          class="relative rounded-lg border border-white/15 px-3 py-1.5 text-sm transition-colors hover:accent"
        >
          ♥
          @if (favorites.count() > 0) {
            <span
              class="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-xs font-bold text-ink-950"
            >
              {{ favorites.count() }}
            </span>
          }
        </a>
        <button
          type="button"
          (click)="ui.openCart()"
          [attr.aria-label]="t('nav.cart')"
          class="relative rounded-lg border border-white/15 px-3 py-1.5 text-sm transition-colors hover:accent"
        >
          🛒
          @if (cart.count() > 0) {
            <span
              class="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-xs font-bold text-ink-950"
            >
              {{ cart.count() }}
            </span>
          }
        </button>
        <button
          type="button"
          (click)="ui.toggleLocale()"
          [attr.aria-label]="t('a11y.toggleLanguage') + ' — ' + ui.otherLocale()"
          class="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold uppercase transition-colors hover:accent"
        >
          {{ ui.otherLocale() }}
        </button>
        <button
          type="button"
          (click)="ui.toggleTheme()"
          [attr.aria-label]="t('a11y.toggleTheme')"
          [attr.aria-pressed]="ui.isLight()"
          class="rounded-lg border border-white/15 px-3 py-1.5 text-sm transition-colors hover:accent"
        >
          {{ ui.isLight() ? '☾' : '☀' }}
        </button>
      </div>
    </header>
  `,
})
export class Header {
  protected readonly ui = inject(UiStore);
  protected readonly cart = inject(CartStore);
  protected readonly favorites = inject(FavoritesStore);
  protected readonly links = [
    { path: '/catalog', label: 'nav.catalog' },
    { path: '/gallery', label: 'nav.gallery' },
    { path: '/recommender', label: 'nav.recommender' },
    { path: '/favorites', label: 'nav.favorites' },
  ];
}
