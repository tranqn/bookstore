import { inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Surfaces new service-worker versions as a reload toast, so visitors never
 *  keep browsing a stale deploy. */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly updateReady = signal(false);
  private readonly updates = inject(SwUpdate);

  constructor() {
    if (this.updates.isEnabled) {
      this.updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          this.updateReady.set(true);
        }
      });
    }
  }

  reload(): void {
    location.reload();
  }
}
