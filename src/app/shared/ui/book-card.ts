import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Book } from '../../core/models/book';
import { formatMoney } from '../../core/util/format';
import { UiStore } from '../../stores/ui.store';
import { RatingStars } from './rating-stars';

@Component({
  selector: 'app-book-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RatingStars],
  host: { class: 'block' },
  template: `
    <a
      [routerLink]="['/book', book().id]"
      class="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] surface-raised shadow-lg ring-1 ring-white/5 transition-[transform,box-shadow] duration-300 will-change-transform hover:-translate-y-2 hover:shadow-[var(--shadow-glow)] focus-visible:-translate-y-2"
    >
      <div class="relative aspect-2/3 overflow-hidden bg-ink-800">
        <img
          [src]="book().cover.medium"
          [alt]="book().title"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span
          class="absolute left-2 top-2 rounded-full bg-ink-950/80 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur"
        >
          {{ book().genre }}
        </span>
      </div>

      <div class="flex flex-1 flex-col gap-1 p-4">
        <h3 class="line-clamp-2 font-bold leading-snug">{{ book().title }}</h3>
        <p class="text-sm text-muted">{{ book().author }}</p>
        <div class="mt-auto flex items-center justify-between pt-3">
          <app-rating-stars [value]="book().rating" />
          <span class="font-bold accent">{{ price() }}</span>
        </div>
      </div>
    </a>
  `,
})
export class BookCard {
  private readonly ui = inject(UiStore);
  readonly book = input.required<Book>();
  protected readonly price = computed(() =>
    formatMoney(this.book().price, this.ui.locale()),
  );
}
