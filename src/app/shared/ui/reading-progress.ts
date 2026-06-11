import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';

/** Thin coral bar pinned to the top of the viewport that tracks page scroll —
 *  a tactile "how far through" cue on long detail pages. Browser-only. */
@Component({
  selector: 'app-reading-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:scroll)': 'update()',
    '(window:resize)': 'update()',
  },
  template: `
    <div
      class="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-coral-500"
      [style.transform]="'scaleX(' + progress() + ')'"
      role="progressbar"
      aria-label="Reading progress"
      [attr.aria-valuenow]="(progress() * 100).toFixed(0)"
      aria-valuemin="0"
      aria-valuemax="100"
    ></div>
  `,
})
export class ReadingProgress {
  protected readonly progress = signal(0);

  protected update(): void {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    this.progress.set(max > 0 ? Math.min(1, doc.scrollTop / max) : 0);
  }
}
