import { inject, Injectable } from '@angular/core';
import { PlatformService } from './platform';

/** Typed, SSR-safe localStorage wrapper. No-ops on the server. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platform = inject(PlatformService);
  private readonly prefix = 'bookstore:';

  get<T>(key: string, fallback: T): T {
    if (!this.platform.isBrowser) return fallback;
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    if (!this.platform.isBrowser) return;
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      /* quota / privacy mode — ignore */
    }
  }
}
