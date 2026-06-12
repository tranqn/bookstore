import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';

/** Interactive 1–5 star picker for the review form (radiogroup semantics). */
@Component({
  selector: 'app-rating-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="label()"
      class="inline-flex items-center gap-0.5"
    >
      @for (star of stars; track star) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value() === star"
          [attr.aria-label]="star + ' / 5'"
          (click)="value.set(value() === star ? 0 : star)"
          class="grid h-8 w-8 place-items-center rounded text-xl leading-none transition-transform hover:scale-125"
          [class]="star <= value() ? 'text-coral-500' : 'text-muted opacity-50'"
        >
          {{ star <= value() ? '★' : '☆' }}
        </button>
      }
    </div>
  `,
})
export class RatingInput {
  readonly label = input('');
  readonly value = model(0);
  protected readonly stars = [1, 2, 3, 4, 5] as const;
}
