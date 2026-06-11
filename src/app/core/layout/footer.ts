import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  template: `
    <footer
      *transloco="let t"
      class="mt-16 border-t border-white/10 px-6 py-8 text-center text-sm text-muted"
    >
      — {{ t('footer.designed') }} —
    </footer>
  `,
})
export class Footer {}
