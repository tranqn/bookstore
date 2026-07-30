import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { PlatformService } from '../../core/services/platform';
import { ScrollService } from '../../core/services/scroll';
import { supportsWebGL } from '../../core/services/webgl';
import { BookCard } from '../../shared/ui/book-card';
import { CatalogStore } from '../../stores/catalog.store';
import { BookGallery } from './book-gallery';

type View = 'gallery' | 'grid';

@Component({
  selector: 'app-gallery3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, BookCard, BookGallery],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <ng-container *transloco="let t">
      @if (showGallery()) {
        <!-- Immersive, phantom.land-style full-viewport cover wall. The fixed
             overlay escapes the page's max-width container; the translucent
             site header (z-40) floats on top of the canvas (z-30). -->
        <div class="fixed inset-0 z-30 bg-ink-950">
          @defer (on viewport) {
            <app-book-gallery [focus]="focus()" />
          } @placeholder {
            <div class="grid h-full place-items-center">
              <span class="text-muted">◈</span>
            </div>
          } @loading (minimum 300ms) {
            <div class="grid h-full place-items-center">
              <span class="animate-pulse text-muted">{{ t('gallery.loading') }}</span>
            </div>
          }

          <!-- Accessible heading + route into the grid for SR/keyboard users. -->
          <h1 class="sr-only">{{ t('nav.gallery') }}</h1>

          <div
            class="pointer-events-none fixed inset-x-0 bottom-6 flex flex-col items-center gap-2"
          >
            <button
              type="button"
              (click)="toggle()"
              class="group pointer-events-auto relative overflow-hidden rounded-full surface-raised px-5 py-2.5 text-sm font-semibold shadow-2xl ring-1 ring-white/15 backdrop-blur-md transition-colors duration-300 hover:text-ink-950"
            >
              <span
                aria-hidden="true"
                class="absolute inset-0 translate-y-full bg-gradient-to-t from-coral-600 to-coral-400 transition-transform duration-300 ease-out group-hover:translate-y-0"
              ></span>
              <span class="relative z-10">{{ t('gallery.viewGrid') }}</span>
            </button>
            <p
              class="group pointer-events-auto relative overflow-hidden rounded-full surface-raised px-4 py-1.5 text-xs text-muted shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-colors duration-300 hover:text-ink-950"
            >
              <span
                aria-hidden="true"
                class="absolute inset-0 translate-y-full bg-gradient-to-t from-coral-600 to-coral-400 transition-transform duration-300 ease-out group-hover:translate-y-0"
              ></span>
              <span class="relative z-10">{{ t('gallery.controls') }}</span>
            </p>
          </div>
        </div>
      } @else {
        <section class="py-10">
          <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 class="text-3xl font-extrabold sm:text-4xl">{{ t('nav.gallery') }}</h1>
              <p class="mt-2 max-w-xl text-muted">{{ t('gallery.hint') }}</p>
            </div>

            @if (canUseGallery()) {
              <button
                type="button"
                (click)="toggle()"
                class="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold transition-colors hover:accent"
              >
                {{ t('gallery.view3d') }}
              </button>
            }
          </header>

          <!-- Accessible / reduced-motion / no-WebGL fallback (also the SSR view). -->
          <ul class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            @for (book of catalog.entities(); track book.id) {
              <li><app-book-card [book]="book" /></li>
            }
          </ul>
        </section>
      }
    </ng-container>
  `,
})
export class Gallery3d {
  protected readonly catalog = inject(CatalogStore);
  private readonly platform = inject(PlatformService);
  private readonly scroll = inject(ScrollService);
  private readonly destroyRef = inject(DestroyRef);

  /** Deep link `/gallery?focus=<bookId>` — camera flies to that book. */
  readonly focus = input<string>();

  protected readonly canUseGallery = signal(false);
  protected readonly view = signal<View>('grid');
  protected readonly showGallery = computed(
    () => this.canUseGallery() && this.view() === 'gallery',
  );

  constructor() {
    // WebGL + motion checks are browser-only; SSR keeps the 2D grid.
    afterNextRender(() => {
      const capable =
        !this.platform.prefersReducedMotion() && supportsWebGL();
      this.canUseGallery.set(capable);
      this.view.set(capable ? 'gallery' : 'grid');
    });

    // While the immersive wall owns the viewport, freeze page scroll so it
    // behaves like an app rather than a tall scrolling document.
    effect(() => {
      const immersive = this.showGallery();
      if (!this.platform.isBrowser) return;
      if (immersive) {
        document.documentElement.style.overflow = 'hidden';
        this.scroll.pause();
      } else {
        document.documentElement.style.overflow = '';
        this.scroll.resume();
      }
    });

    // Leaving the route (e.g. via a header link) while immersive must restore.
    this.destroyRef.onDestroy(() => {
      if (!this.platform.isBrowser) return;
      document.documentElement.style.overflow = '';
      this.scroll.resume();
    });
  }

  protected toggle(): void {
    this.view.update((v) => (v === 'gallery' ? 'grid' : 'gallery'));
  }

  /** Escape exits the immersive wall back to the grid (no-op otherwise). */
  protected onEscape(): void {
    if (this.showGallery()) this.view.set('grid');
  }
}
