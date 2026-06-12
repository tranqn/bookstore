import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import type { Book, Locale } from '../models/book';
import { SITE_NAME, SITE_ORIGIN } from '../config/site';

const JSON_LD_ID = 'book-jsonld';

/** Social cards + structured data. Book pages are prerendered, so everything
 *  written here lands in the static HTML that crawlers see. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  setBookMeta(book: Book, locale: Locale): void {
    const description = book.description[locale];
    const image = this.absolute(book.cover.large);

    this.meta.updateTag({ name: 'description', content: description });
    this.upsertProperty('og:type', 'book');
    this.upsertProperty('og:site_name', SITE_NAME);
    this.upsertProperty('og:title', `${book.title} — ${SITE_NAME}`);
    this.upsertProperty('og:description', description);
    this.upsertProperty('og:image', image);
    this.upsertProperty('og:url', `${SITE_ORIGIN}/book/${book.id}`);
    this.upsertProperty('og:locale', locale === 'de' ? 'de_DE' : 'en_GB');
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: book.title });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    this.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: book.title,
      author: { '@type': 'Person', name: book.author },
      description,
      inLanguage: locale,
      ...(book.isbn ? { isbn: book.isbn } : {}),
      ...(book.pageCount ? { numberOfPages: book.pageCount } : {}),
      datePublished: String(book.publishedYear),
      image,
      genre: book.genre,
      offers: {
        '@type': 'Offer',
        price: book.price.amount.toFixed(2),
        priceCurrency: book.price.currency,
        availability: 'https://schema.org/InStock',
        url: `${SITE_ORIGIN}/book/${book.id}`,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: book.rating,
        bestRating: 5,
        ratingCount: book.likeCount,
      },
    });
  }

  clearBookMeta(): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
    for (const prop of ['og:type', 'og:title', 'og:description', 'og:image', 'og:url']) {
      this.meta.removeTag(`property="${prop}"`);
    }
  }

  private setJsonLd(payload: Record<string, unknown>): void {
    let script = this.doc.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
    if (!script) {
      script = this.doc.createElement('script');
      script.id = JSON_LD_ID;
      script.type = 'application/ld+json';
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(payload);
  }

  private upsertProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property="${property}"`);
  }

  private absolute(path: string): string {
    return path.startsWith('http') ? path : `${SITE_ORIGIN}${path}`;
  }
}
