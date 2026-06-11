import { inject, Injectable } from '@angular/core';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';
import type LenisType from 'lenis';
import { PlatformService } from './platform';

/** App-wide smooth scroll (Lenis) wired into GSAP ScrollTrigger.
 *  Deps are dynamically imported after hydration so GSAP/Lenis stay out of the
 *  initial bundle. Inert on the server and under prefers-reduced-motion. */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly platform = inject(PlatformService);
  private lenis?: LenisType;
  private scrollTrigger?: typeof ScrollTriggerType;
  private rafId = 0;
  private started = false;

  async init(): Promise<void> {
    if (
      this.started ||
      !this.platform.isBrowser ||
      this.platform.prefersReducedMotion()
    ) {
      return;
    }
    this.started = true;

    const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('lenis'),
    ]);
    gsap.registerPlugin(ScrollTrigger);
    this.scrollTrigger = ScrollTrigger;

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    this.lenis = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      this.rafId = requestAnimationFrame(raf);
    };
    this.rafId = requestAnimationFrame(raf);
  }

  /** Jump to top immediately (used on route change). */
  toTop(): void {
    this.lenis?.scrollTo(0, { immediate: true });
  }

  destroy(): void {
    if (!this.started) return; // never ran (server / reduced-motion)
    cancelAnimationFrame(this.rafId);
    this.lenis?.destroy();
    this.scrollTrigger?.getAll().forEach((t) => t.kill());
    this.started = false;
  }
}
