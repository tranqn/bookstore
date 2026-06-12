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
import { PlatformService } from '../../core/services/platform';
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
  private readonly platform = inject(PlatformService);

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

  /** Show a field error only once the user has interacted with it. */
  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  private placeOrder(): void {
    this.orderId.set(
      'BK-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    );
    this.cart.clear();
    this.step.set(3);
    void this.launchConfetti();
  }

  /** GSAP confetti burst on the success step (skipped under reduced motion). */
  private async launchConfetti(): Promise<void> {
    if (!this.platform.isBrowser || this.platform.prefersReducedMotion()) {
      return;
    }
    const { gsap } = await import('gsap');
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:60';
    document.body.appendChild(host);

    const colors = ['#ff8970', '#ffa08a', '#6056d2', '#f4f1ea', '#e86e56'];
    const pieces = Array.from({ length: 110 }, () => {
      const el = document.createElement('span');
      const size = 6 + Math.random() * 8;
      el.style.cssText =
        `position:absolute;top:-5vh;left:${Math.random() * 100}vw;` +
        `width:${size}px;height:${size * 0.45}px;border-radius:1px;` +
        `background:${colors[(Math.random() * colors.length) | 0]}`;
      host.appendChild(el);
      return el;
    });

    gsap.to(pieces, {
      y: () => window.innerHeight * gsap.utils.random(1.05, 1.3),
      x: () => gsap.utils.random(-140, 140),
      rotation: () => gsap.utils.random(-560, 560),
      duration: () => gsap.utils.random(1.8, 3),
      ease: 'power1.in',
      stagger: { each: 0.012, from: 'random' },
      onComplete: () => host.remove(),
    });
  }
}
