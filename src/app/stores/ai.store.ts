import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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

type Status = 'idle' | 'loading' | 'success' | 'error';

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

interface RecommendResponse {
  results: Recommendation[];
  source: 'gemini' | 'local';
}

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
      isLoading: computed(() => store.status() === 'loading'),
    };
  }),
  withMethods((store) => {
    const http = inject(HttpClient);
    const ui = inject(UiStore);
    const catalog = inject(CatalogStore);

    return {
      async recommend(query: string): Promise<void> {
        const trimmed = query.trim();
        patchState(store, { query: trimmed });
        if (trimmed.length < 2) return;
        patchState(store, { status: 'loading', results: [] });

        try {
          const res = await firstValueFrom(
            http.post<RecommendResponse>('/api/recommend', {
              query: trimmed,
              locale: ui.locale(),
            }),
          );
          patchState(store, {
            status: 'success',
            results: res.results,
            source: res.source,
          });
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
      reset(): void {
        patchState(store, { query: '', status: 'idle', results: [], source: null });
      },
    };
  }),
);
