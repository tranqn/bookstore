import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Single source of truth for "are we in the browser?".
 *  Everything touching window / document / WebGL / localStorage guards on this. */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private matches(query: string, fallback: boolean): boolean {
    if (!this.isBrowser || typeof window.matchMedia !== 'function') {
      return fallback;
    }
    return window.matchMedia(query).matches;
  }

  prefersReducedMotion(): boolean {
    return this.matches('(prefers-reduced-motion: reduce)', false);
  }

  prefersDark(): boolean {
    // Default to the signature dark theme when preference is unknown.
    return this.matches('(prefers-color-scheme: dark)', true);
  }
}
