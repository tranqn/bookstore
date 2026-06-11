import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { formatMoney } from '../../core/util/format';
import { CartStore } from '../../stores/cart.store';
import { UiStore } from '../../stores/ui.store';

type Step = 0 | 1 | 2 | 3;

@Component({
  selector: 'app-checkout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, TranslocoDirective],
  templateUrl: './checkout.html',
})
export class Checkout {
  protected readonly cart = inject(CartStore);
  protected readonly ui = inject(UiStore);
  private readonly fb = inject(FormBuilder);

  protected readonly step = signal<Step>(0);
  protected readonly orderId = signal('');

  protected readonly stepKeys = ['cart', 'details', 'payment', 'done'] as const;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.required],
    city: ['', Validators.required],
    zip: ['', [Validators.required, Validators.pattern(/^\d{4,5}$/)]],
    card: ['', [Validators.required, Validators.pattern(/^[\d ]{12,19}$/)]],
  });

  protected money(n: number): string {
    return formatMoney({ amount: n, currency: 'EUR' }, this.ui.locale());
  }

  /** Per-step gate for the Next/Pay button. */
  protected canAdvance(): boolean {
    const f = this.form.controls;
    switch (this.step()) {
      case 0:
        return !this.cart.isEmpty();
      case 1:
        return (
          f.name.valid && f.email.valid && f.address.valid && f.city.valid && f.zip.valid
        );
      case 2:
        return f.card.valid;
      default:
        return true;
    }
  }

  protected next(): void {
    if (!this.canAdvance()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.step() === 2) {
      this.placeOrder();
      return;
    }
    this.step.update((s) => Math.min(3, s + 1) as Step);
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1) as Step);
  }

  private placeOrder(): void {
    this.orderId.set(
      'BK-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    );
    this.cart.clear();
    this.step.set(3);
  }
}
