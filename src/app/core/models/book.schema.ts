import { z } from 'zod';
import type { Book } from './book';

/** Runtime contract for a seed entry. Shared by the build-time seed generator
 *  (`scripts/fetch-seed.ts`) and a unit test, so the committed JSON can't drift
 *  from the `Book` interface. */
export const GenreSchema = z.enum([
  'Fantasy',
  'Romantik',
  'Science-Fiction',
  'Thriller',
  'Sachbuch',
]);

export const BookSchema = z.object({
  id: z.string().min(1),
  isbn: z.string().optional(),
  title: z.string().min(1),
  author: z.string().min(1),
  description: z.object({ de: z.string().min(1), en: z.string().min(1) }),
  genre: GenreSchema,
  tags: z.array(z.string()),
  price: z.object({
    amount: z.number().positive(),
    currency: z.literal('EUR'),
  }),
  publishedYear: z.number().int(),
  rating: z.number().min(0).max(5),
  likeCount: z.number().int().nonnegative(),
  cover: z.object({
    id: z.number().int(),
    // Either a remote https URL (fresh seed) or a local /covers/… path
    // (after scripts/optimize-covers.ts has run).
    small: z.string().min(1),
    medium: z.string().min(1),
    large: z.string().min(1),
    lqip: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    blurhash: z.string().optional(),
  }),
  pageCount: z.number().int().positive().optional(),
}) satisfies z.ZodType<Book>;

export const BookSeedSchema = z.array(BookSchema);

export type BookSeed = z.infer<typeof BookSeedSchema>;
