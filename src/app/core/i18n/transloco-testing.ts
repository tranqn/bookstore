import {
  TranslocoTestingModule,
  TranslocoTestingOptions,
} from '@jsverse/transloco';

/** Minimal Transloco setup for unit tests. Missing keys render as the key,
 *  which is fine for smoke tests that don't assert translated copy. */
export function getTranslocoModule(options: TranslocoTestingOptions = {}) {
  return TranslocoTestingModule.forRoot({
    langs: { de: {}, en: {} },
    translocoConfig: {
      availableLangs: ['de', 'en'],
      defaultLang: 'de',
    },
    preloadLangs: true,
    ...options,
  });
}
