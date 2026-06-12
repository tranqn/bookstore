import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { Book, Recommendation } from '../core/models/book';
import { localRecommend } from '../core/ai/local-recommender';
import { CatalogStore } from './catalog.store';
import { UiStore } from './ui.store';

type Status = 'idle' | 'loading' | 'streaming' | 'success' | 'error';

interface AiState {
  query: string;
  status: Status;
  results: Recommendation[];
  source: 'gemini' | 'local' | null;
}

export interface RecommendationCard {
  book: Book;
  reason: string;
  score: number;
}

type StreamEvent =
  | { type: 'rec'; bookId: string; reason: string; score: number }
  | { type: 'done'; source: 'gemini' | 'local' };

export const AiStore = signalStore(
  { providedIn: 'root' },
  withState<AiState>({ query: '', status: 'idle', results: [], source: null }),
  withComputed((store) => {
    const catalog = inject(CatalogStore);
    return {
      cards: computed<RecommendationCard[]>(() =>
        store
          .results()
          .map((r) => {
            const book = catalog.byId(r.bookId);
            return book ? { book, reason: r.reason, score: r.score } : null;
          })
          .filter((c): c is RecommendationCard => c !== null),
      ),
      /** Skeleton phase: nothing has arrived yet. */
      isLoading: computed(() => store.status() === 'loading'),
      /** Anything in flight (disables the submit button). */
      isBusy: computed(
        () => store.status() === 'loading' || store.status() === 'streaming',
      ),
    };
  }),
  withMethods((store) => {
    const ui = inject(UiStore);
    const catalog = inject(CatalogStore);

    return {
      async recommend(query: string): Promise<void> {
        const trimmed = query.trim();
        patchState(store, { query: trimmed });
        if (trimmed.length < 2) return;
        patchState(store, { status: 'loading', results: [], source: null });

        try {
          const res = await fetch('/api/recommend', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Ask for the streaming protocol; plain JSON stays the fallback.
              Accept: 'application/x-ndjson, application/json',
            },
            body: JSON.stringify({ query: trimmed, locale: ui.locale() }),
          });
          if (!res.ok) throw new Error(`recommend failed: ${res.status}`);

          const isStream =
            res.headers.get('content-type')?.includes('ndjson') && res.body;
          if (isStream) {
            await this._consumeStream(res.body as ReadableStream<Uint8Array>);
          } else {
            const data = (await res.json()) as {
              results: Recommendation[];
              source: 'gemini' | 'local';
            };
            patchState(store, { results: data.results, source: data.source });
          }
          if (store.results().length === 0) throw new Error('empty response');
          patchState(store, { status: 'success' });
        } catch {
          // Endpoint unreachable (e.g. static host) — recommend on the client.
          const results = localRecommend(
            trimmed,
            catalog.entities(),
            ui.locale(),
            4,
          );
          patchState(store, { status: 'success', results, source: 'local' });
        }
      },

      /** Reads NDJSON lines and appends cards as the model produces them. */
      async _consumeStream(body: ReadableStream<Uint8Array>): Promise<void> {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handle = (line: string): void => {
          if (!line) return;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'rec') {
            patchState(store, {
              status: 'streaming',
              results: [
                ...store.results(),
                { bookId: event.bookId, reason: event.reason, score: event.score },
              ],
            });
          } else if (event.type === 'done') {
            patchState(store, { source: event.source });
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            handle(buffer.slice(0, nl).trim());
            buffer = buffer.slice(nl + 1);
          }
        }
        handle(buffer.trim());
      },

      reset(): void {
        patchState(store, { query: '', status: 'idle', results: [], source: null });
      },
    };
  }),
);
