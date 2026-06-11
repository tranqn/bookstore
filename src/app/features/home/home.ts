import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PlatformService } from '../../core/services/platform';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  template: `
    <section
      *transloco="let t"
      class="relative isolate overflow-hidden rounded-3xl"
    >
      <div
        data-anim="bg"
        class="absolute inset-0 -z-10 scale-110 bg-cover bg-center opacity-40"
        style="background-image: url('/imgs/bg.jpg')"
        aria-hidden="true"
      ></div>
      <div
        class="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent"
        aria-hidden="true"
      ></div>

      <div class="flex min-h-[78vh] flex-col justify-center px-6 py-20 sm:px-12">
        <p data-anim="kicker" class="mb-4 text-sm font-semibold uppercase tracking-[0.2em] accent">
          {{ t('home.kicker') }}
        </p>
        <h1 data-anim="title" class="max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
          {{ t('home.title') }}
        </h1>
        <p data-anim="sub" class="mt-6 max-w-xl text-lg text-muted">
          {{ t('home.subtitle') }}
        </p>

        <div data-anim="cta" class="mt-10 flex flex-wrap gap-4">
          <a
            routerLink="/gallery"
            class="rounded-xl bg-coral-500 px-6 py-3 font-semibold text-ink-950 shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-1"
          >
            {{ t('home.ctaGallery') }}
          </a>
          <a
            routerLink="/catalog"
            class="rounded-xl border border-white/25 px-6 py-3 font-semibold transition-colors hover:accent"
          >
            {{ t('home.ctaCatalog') }}
          </a>
        </div>
      </div>
    </section>
  `,
})
export class Home {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly platform = inject(PlatformService);
  private readonly destroyRef = inject(DestroyRef);
  private ctx?: gsap.Context;

  constructor() {
    afterNextRender(() => {
      if (this.platform.prefersReducedMotion()) return;
      const el = this.host.nativeElement as HTMLElement;
      gsap.registerPlugin(ScrollTrigger);

      this.ctx = gsap.context(() => {
        // Cinematic entrance stagger.
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('[data-anim="kicker"]', { y: 20, opacity: 0, duration: 0.5 })
          .from('[data-anim="title"]', { y: 36, opacity: 0, duration: 0.8 }, '-=0.2')
          .from('[data-anim="sub"]', { y: 24, opacity: 0, duration: 0.6 }, '-=0.4')
          .from('[data-anim="cta"]', { y: 20, opacity: 0, duration: 0.5 }, '-=0.3');

        // Background parallax tied to scroll.
        gsap.to('[data-anim="bg"]', {
          yPercent: 18,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }, el);
    });

    // Revert animations + kill this route's ScrollTriggers on leave.
    this.destroyRef.onDestroy(() => this.ctx?.revert());
  }
}
