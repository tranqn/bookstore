import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import type { Book } from '../../core/models/book';
import { PlatformService } from '../../core/services/platform';
import { ViewTransitionService } from '../../core/services/view-transition';
import { CatalogStore } from '../../stores/catalog.store';
import { UiStore } from '../../stores/ui.store';

interface PaletteItem {
  id: string;
  kind: 'book' | 'action';
  label: string;
  sub: string;
  icon: string;
  run: () => void;
}

/** ⌘K / Ctrl+K command palette — native <dialog>, no CDK.
 *  Fuzzy-searches the catalog and exposes quick actions (nav, theme, locale). */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  host: {
    '(document:keydown)': 'onGlobalKeydown($event)',
  },
  template: `
    <dialog
      #dialog
      *transloco="let t"
      (close)="ui.closePalette()"
      (click)="onBackdropClick($event)"
      [attr.aria-label]="t('palette.title')"
      class="m-auto w-[min(92vw,40rem)] rounded-2xl bg-transparent p-0 backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm"
    >
      <div class="surface-raised flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-2xl">
        <div class="flex items-center gap-3 border-b border-white/10 px-4">
          <span aria-hidden="true" class="text-muted">⌕</span>
          <input
            #queryInput
            type="text"
            [value]="query()"
            (input)="onQuery($event)"
            (keydown)="onInputKeydown($event)"
            [placeholder]="t('palette.placeholder')"
            class="w-full bg-transparent py-4 text-base outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-options"
            [attr.aria-activedescendant]="'palette-item-' + activeIndex()"
            autocomplete="off"
            spellcheck="false"
          />
          <kbd class="rounded border border-white/20 px-1.5 py-0.5 text-xs text-muted">esc</kbd>
        </div>

        <ul id="palette-options" role="listbox" class="max-h-[55vh] overflow-y-auto p-2">
          @for (item of items(); track item.kind + item.id; let i = $index) {
            <li
              [id]="'palette-item-' + i"
              role="option"
              [attr.aria-selected]="i === activeIndex()"
              (click)="execute(item)"
              (mousemove)="activeIndex.set(i)"
              class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
              [class]="i === activeIndex() ? 'bg-coral-500/15 ring-1 ring-coral-500/40' : ''"
            >
              <span aria-hidden="true" class="w-6 text-center">{{ item.icon }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ item.label }}</span>
                @if (item.sub) {
                  <span class="block truncate text-xs text-muted">{{ item.sub }}</span>
                }
              </span>
              @if (item.kind === 'action') {
                <span class="text-xs uppercase tracking-wide text-muted">
                  {{ t('palette.action') }}
                </span>
              }
            </li>
          } @empty {
            <li class="px-3 py-6 text-center text-sm text-muted">
              {{ t('palette.noResults') }}
            </li>
          }
        </ul>

        <div class="flex items-center gap-4 border-t border-white/10 px-4 py-2 text-xs text-muted">
          <span><kbd class="font-sans">↑↓</kbd> {{ t('palette.hintNavigate') }}</span>
          <span><kbd class="font-sans">↵</kbd> {{ t('palette.hintSelect') }}</span>
        </div>
      </div>
    </dialog>
  `,
})
export class CommandPalette {
  protected readonly ui = inject(UiStore);
  private readonly catalog = inject(CatalogStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly platform = inject(PlatformService);
  private readonly viewTransition = inject(ViewTransitionService);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly queryInput =
    viewChild<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  private readonly actions = computed<PaletteItem[]>(() => {
    // Depend on the active locale so labels re-translate on switch.
    this.ui.locale();
    const t = (key: string): string => this.transloco.translate(key);
    const go = (path: string) => () => void this.router.navigateByUrl(path);
    return [
      { id: 'catalog', kind: 'action', icon: '📖', sub: '/catalog', label: t('nav.catalog'), run: go('/catalog') },
      { id: 'gallery', kind: 'action', icon: '🧊', sub: '/gallery', label: t('nav.gallery'), run: go('/gallery') },
      { id: 'recommender', kind: 'action', icon: '✨', sub: '/recommender', label: t('nav.recommender'), run: go('/recommender') },
      { id: 'favorites', kind: 'action', icon: '♥', sub: '/favorites', label: t('nav.favorites'), run: go('/favorites') },
      { id: 'theme', kind: 'action', icon: this.ui.isLight() ? '☾' : '☀', sub: '', label: t('a11y.toggleTheme'), run: () => this.ui.toggleTheme() },
      { id: 'locale', kind: 'action', icon: '🌐', sub: this.ui.otherLocale().toUpperCase(), label: t('a11y.toggleLanguage'), run: () => this.ui.toggleLocale() },
    ];
  });

  protected readonly items = computed<PaletteItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const books = this.matchBooks(q).map<PaletteItem>((b) => ({
      id: b.id,
      kind: 'book',
      icon: '📕',
      label: b.title,
      sub: `${b.author} · ${b.genre}`,
      run: () => {
        this.viewTransition.activeBookId.set(b.id);
        void this.router.navigate(['/book', b.id]);
      },
    }));
    const actions = q
      ? this.actions().filter((a) => a.label.toLowerCase().includes(q))
      : this.actions();
    return q ? [...books, ...actions] : [...actions, ...books];
  });

  constructor() {
    effect(() => {
      if (!this.platform.isBrowser) return;
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.ui.paletteOpen()) {
        if (!dialog.open) dialog.showModal();
        this.query.set('');
        this.activeIndex.set(0);
        this.queryInput()?.nativeElement.focus();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  private matchBooks(q: string): Book[] {
    const all = this.catalog.entities();
    if (!q) return all.slice(0, 6);
    const tokens = q.split(/\s+/);
    return all
      .map((b) => {
        const haystack =
          `${b.title} ${b.author} ${b.genre} ${b.tags.join(' ')}`.toLowerCase();
        let score = 0;
        for (const token of tokens) {
          const idx = haystack.indexOf(token);
          if (idx === -1) return null;
          score += idx === 0 ? 2 : 1;
        }
        return { b, score };
      })
      .filter((hit): hit is { b: Book; score: number } => hit !== null)
      .sort((x, y) => y.score - x.score)
      .slice(0, 8)
      .map((hit) => hit.b);
  }

  protected onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.ui.togglePalette();
    }
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    const count = this.items().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((i) => (count ? (i + 1) % count : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((i) => (count ? (i - 1 + count) % count : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.items()[this.activeIndex()];
      if (item) this.execute(item);
    }
  }

  protected execute(item: PaletteItem): void {
    this.ui.closePalette();
    item.run();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.ui.closePalette();
  }
}
