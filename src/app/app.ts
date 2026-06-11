import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Header } from './core/layout/header';
import { Footer } from './core/layout/footer';
import { CartDrawer } from './core/layout/cart-drawer';
import { ScrollService } from './core/services/scroll';
import { UiStore } from './stores/ui.store';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer, CartDrawer, TranslocoDirective],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Eagerly instantiate the UI store so theme/locale hydrate on first paint.
  protected readonly ui = inject(UiStore);
  private readonly scroll = inject(ScrollService);

  constructor() {
    afterNextRender(() => this.scroll.init());
    inject(DestroyRef).onDestroy(() => this.scroll.destroy());
  }
}

