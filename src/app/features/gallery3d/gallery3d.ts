import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { PlatformService } from '../../core/services/platform';
import { supportsWebGL } from '../../core/services/webgl';
import { BookCard } from '../../shared/ui/book-card';
import { CatalogStore } from '../../stores/catalog.store';
import { BookShelf } from './book-shelf';

type View = '3d' | 'grid';

@Component({
  selector: 'app-gallery3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, BookCard, BookShelf],
  template: `
    <section *transloco="let t" class="py-10">
      <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold sm:text-4xl">{{ t('nav.gallery') }}</h1>
          <p class="mt-2 max-w-xl text-muted">{{ t('gallery.hint') }}</p>
        </div>

        @if (canUse3d()) {
          <button
            type="button"
            (click)="toggle()"
            class="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold transition-colors hover:accent"
          >
            {{ view() === '3d' ? t('gallery.viewGrid') : t('gallery.view3d') }}
          </button>
        }
      </header>

      @if (show3d()) {
        @defer (on viewport) {
          <app-book-shelf />
        } @placeholder {
          <div class="grid h-[70vh] place-items-center rounded-3xl bg-ink-900/40">
            <span class="text-muted">◈</span>
          </div>
        } @loading (minimum 300ms) {
          <div class="grid h-[70vh] place-items-center rounded-3xl bg-ink-900/40">
            <span class="animate-pulse text-muted">{{ t('gallery.loading') }}</span>
          </div>
        }
        <p class="mt-3 text-center text-sm text-muted">{{ t('gallery.controls') }}</p>
      } @else {
        <!-- Accessible / reduced-motion / no-WebGL fallback (also the SSR view). -->
        <ul class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          @for (book of catalog.entities(); track book.id) {
            <li><app-book-card [book]="book" /></li>
          }
        </ul>
      }
    </section>
  `,
})
export class Gallery3d {
  protected readonly catalog = inject(CatalogStore);
  private readonly platform = inject(PlatformService);

  protected readonly canUse3d = signal(false);
  protected readonly view = signal<View>('grid');
  protected readonly show3d = computed(
    () => this.canUse3d() && this.view() === '3d',
  );

  constructor() {
    // WebGL + motion checks are browser-only; SSR keeps the 2D grid.
    afterNextRender(() => {
      const capable =
        !this.platform.prefersReducedMotion() && supportsWebGL();
      this.canUse3d.set(capable);
      this.view.set(capable ? '3d' : 'grid');
    });
  }

  protected toggle(): void {
    this.view.update((v) => (v === '3d' ? 'grid' : '3d'));
  }
}
