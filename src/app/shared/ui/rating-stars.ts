import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 text-sm"
      [attr.aria-label]="value() + ' / 5'"
    >
      <span class="text-coral-500" aria-hidden="true">{{ stars() }}</span>
      <span class="text-muted">{{ value().toFixed(1) }}</span>
    </span>
  `,
})
export class RatingStars {
  readonly value = input.required<number>();
  protected readonly stars = computed(() => {
    const full = Math.round(this.value());
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  });
}
