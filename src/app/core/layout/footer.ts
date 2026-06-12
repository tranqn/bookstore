import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  template: `
    <footer
      *transloco="let t"
      class="mt-16 border-t border-white/10 px-6 py-8 text-center text-sm text-muted"
    >
      <p>— {{ t('footer.designed') }} —</p>
      <p class="mt-2">
        <a routerLink="/architecture" class="transition-colors hover:accent">
          {{ t('footer.howItsBuilt') }}
        </a>
      </p>
    </footer>
  `,
})
export class Footer {}
