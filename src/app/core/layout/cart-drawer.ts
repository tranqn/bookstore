import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { formatMoney } from '../util/format';
import { CartStore } from '../../stores/cart.store';
import { UiStore } from '../../stores/ui.store';

@Component({
  selector: 'app-cart-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  host: {
    '(document:keydown.escape)': 'ui.closeCart()',
  },
  template: `
    @if (ui.cartOpen()) {
      <div *transloco="let t" class="fixed inset-0 z-50">
        <button
          type="button"
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          [attr.aria-label]="t('cart.close')"
          (click)="ui.closeCart()"
        ></button>

        <aside
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="t('cart.title')"
          class="absolute right-0 top-0 flex h-full w-full max-w-md flex-col surface shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 class="text-lg font-bold">
              {{ t('cart.title') }} ({{ cart.count() }})
            </h2>
            <button
              type="button"
              (click)="ui.closeCart()"
              class="rounded-lg p-2 text-xl text-muted transition-colors hover:accent"
              [attr.aria-label]="t('cart.close')"
            >
              ✕
            </button>
          </header>

          @if (cart.isEmpty()) {
            <div class="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p class="text-muted">{{ t('cart.empty') }}</p>
              <a
                routerLink="/catalog"
                (click)="ui.closeCart()"
                class="rounded-xl border border-white/20 px-4 py-2 text-sm transition-colors hover:accent"
              >
                {{ t('cart.continue') }}
              </a>
            </div>
          } @else {
            <ul class="flex-1 divide-y divide-white/10 overflow-y-auto px-5">
              @for (line of cart.lines(); track line.book.id) {
                <li class="flex gap-3 py-4">
                  <img
                    [src]="line.book.cover.small"
                    [alt]="line.book.title"
                    class="h-20 w-14 shrink-0 rounded object-cover"
                  />
                  <div class="flex min-w-0 flex-1 flex-col">
                    <p class="truncate font-semibold">{{ line.book.title }}</p>
                    <p class="truncate text-sm text-muted">{{ line.book.author }}</p>
                    <div class="mt-auto flex items-center justify-between">
                      <div
                        class="flex items-center rounded-lg border border-white/15"
                        role="group"
                        [attr.aria-label]="t('cart.qty')"
                      >
                        <button
                          type="button"
                          (click)="cart.setQty(line.book.id, line.qty - 1)"
                          class="px-2.5 py-1 text-lg leading-none transition-colors hover:accent"
                          aria-label="−"
                        >
                          −
                        </button>
                        <span class="min-w-8 text-center text-sm tabular-nums">{{ line.qty }}</span>
                        <button
                          type="button"
                          (click)="cart.setQty(line.book.id, line.qty + 1)"
                          class="px-2.5 py-1 text-lg leading-none transition-colors hover:accent"
                          aria-label="+"
                        >
                          +
                        </button>
                      </div>
                      <span class="font-semibold accent">{{ money(line.lineTotal) }}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    (click)="cart.remove(line.book.id)"
                    class="self-start p-1 text-muted transition-colors hover:accent"
                    [attr.aria-label]="t('cart.remove')"
                  >
                    🗑
                  </button>
                </li>
              }
            </ul>

            <footer class="border-t border-white/10 px-5 py-4">
              <div class="mb-1 flex justify-between text-sm text-muted">
                <span>{{ t('cart.shipping') }}</span>
                <span>{{ t('cart.free') }}</span>
              </div>
              <div class="mb-4 flex justify-between text-lg font-bold">
                <span>{{ t('cart.total') }}</span>
                <span class="accent">{{ money(cart.subtotal()) }}</span>
              </div>
              <a
                routerLink="/checkout"
                (click)="ui.closeCart()"
                class="block rounded-xl bg-coral-500 px-5 py-3 text-center font-semibold text-ink-950 shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
              >
                {{ t('cart.checkout') }}
              </a>
            </footer>
          }
        </aside>
      </div>
    }
  `,
})
export class CartDrawer {
  protected readonly cart = inject(CartStore);
  protected readonly ui = inject(UiStore);
  protected money(n: number): string {
    return formatMoney({ amount: n, currency: 'EUR' }, this.ui.locale());
  }
}
