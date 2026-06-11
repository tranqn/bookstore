import { RenderMode, ServerRoute } from '@angular/ssr';
import seed from '../assets/data/books.seed.json';

const bookIds = (seed as { id: string }[]).map((b) => b.id);

export const serverRoutes: ServerRoute[] = [
  {
    // Prerender every book detail page from the committed seed.
    path: 'book/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => bookIds.map((id) => ({ id })),
  },
  { path: '**', renderMode: RenderMode.Prerender },
];
