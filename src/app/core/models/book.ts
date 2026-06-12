export type Locale = 'de' | 'en';
export type Theme = 'dark' | 'light';

export type Genre =
  | 'Fantasy'
  | 'Romantik'
  | 'Science-Fiction'
  | 'Thriller'
  | 'Sachbuch';

export interface Money {
  amount: number;
  currency: 'EUR';
}

export interface BookCover {
  id: number;
  small: string;
  medium: string;
  large: string;
  /** base64 WebP micro-thumbnail used as NgOptimizedImage blur-up placeholder */
  lqip?: string;
  /** intrinsic dimensions of the `large` rendition (prevents CLS) */
  width?: number;
  height?: number;
  blurhash?: string;
}

/** Elevates the legacy `{ name, author, likes, liked, price, comments }` shape.
 *  Keyed on a stable slug `id` — never an array index. */
export interface Book {
  id: string;
  isbn?: string;
  title: string;
  author: string;
  description: Record<Locale, string>;
  genre: Genre;
  tags: string[];
  price: Money;
  publishedYear: number;
  rating: number; // 0–5
  likeCount: number;
  cover: BookCover;
  pageCount?: number;
}

export interface Review {
  id: string;
  bookId: string;
  author: string;
  body: string;
  rating?: number;
  createdAt: string;
}

export interface CartItem {
  bookId: string;
  qty: number;
}

export interface Recommendation {
  bookId: string;
  reason: string;
  score: number;
}
