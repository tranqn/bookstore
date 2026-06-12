import { Injectable, signal } from '@angular/core';

/** Coordinates the shared-element morph of a book cover between the
 *  catalog/favorites grid and the detail hero. Only one element may carry
 *  the `book-cover` view-transition-name at a time, so cards check this id. */
@Injectable({ providedIn: 'root' })
export class ViewTransitionService {
  readonly activeBookId = signal<string | null>(null);
}
