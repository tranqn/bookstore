import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Bookstore',
  },
  {
    path: 'catalog',
    loadComponent: () =>
      import('./features/catalog/catalog').then((m) => m.Catalog),
    title: 'Katalog · Bookstore',
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./features/gallery3d/gallery3d').then((m) => m.Gallery3d),
    title: '3D-Regal · Bookstore',
  },
  {
    path: 'recommender',
    loadComponent: () =>
      import('./features/ai-recommender/ai-recommender').then(
        (m) => m.AiRecommender,
      ),
    title: 'KI-Empfehlung · Bookstore',
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./features/favorites/favorites').then((m) => m.Favorites),
    title: 'Favoriten · Bookstore',
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./features/checkout/checkout').then((m) => m.Checkout),
    title: 'Kasse · Bookstore',
  },
  {
    path: 'book/:id',
    loadComponent: () =>
      import('./features/book-detail/book-detail').then((m) => m.BookDetail),
  },
  { path: '**', redirectTo: '' },
];
