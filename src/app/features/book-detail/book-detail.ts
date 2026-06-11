import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { formatMoney } from '../../core/util/format';
import { CatalogStore } from '../../stores/catalog.store';
import { CartStore } from '../../stores/cart.store';
import { FavoritesStore } from '../../stores/favorites.store';
import { ReviewsStore } from '../../stores/reviews.store';
import { UiStore } from '../../stores/ui.store';
import { RatingStars } from '../../shared/ui/rating-stars';
import { ReadingProgress } from '../../shared/ui/reading-progress';

@Component({
  selector: 'app-book-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    TranslocoDirective,
    RatingStars,
    ReadingProgress,
  ],
  templateUrl: './book-detail.html',
})
export class BookDetail {
  protected readonly ui = inject(UiStore);
  protected readonly cart = inject(CartStore);
  protected readonly favorites = inject(FavoritesStore);
  protected readonly reviews = inject(ReviewsStore);
  private readonly catalog = inject(CatalogStore);
  private readonly title = inject(Title);
  private readonly fb = inject(FormBuilder);

  /** Route param bound via withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly book = computed(() => this.catalog.byId(this.id()));
  protected readonly price = computed(() => {
    const b = this.book();
    return b ? formatMoney(b.price, this.ui.locale()) : '';
  });
  protected readonly inCart = computed(() =>
    this.cart.lines().some((l) => l.book.id === this.id()),
  );
  protected readonly bookReviews = computed(() =>
    this.reviews.forBook(this.id()),
  );

  protected readonly reviewForm = this.fb.nonNullable.group({
    name: [''],
    body: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const b = this.book();
      this.title.setTitle(b ? `${b.title} — Bookstore` : 'Bookstore');
    });
  }

  protected addToCart(): void {
    this.cart.add(this.id());
    this.ui.openCart();
  }

  protected toggleLike(): void {
    this.favorites.toggle(this.id());
  }

  protected submitReview(): void {
    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }
    const { name, body } = this.reviewForm.getRawValue();
    this.reviews.add(this.id(), name, body);
    this.reviewForm.reset({ name: '', body: '' });
  }
}
