import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { TranslocoService } from '@jsverse/transloco';
import type { Locale, Theme } from '../core/models/book';
import { PlatformService } from '../core/services/platform';
import { StorageService } from '../core/services/storage';

interface UiState {
  locale: Locale;
  theme: Theme;
  cartOpen: boolean;
  paletteOpen: boolean;
}

export const UiStore = signalStore(
  { providedIn: 'root' },
  withState<UiState>({
    locale: 'de',
    theme: 'dark',
    cartOpen: false,
    paletteOpen: false,
  }),
  withComputed((store) => ({
    isLight: computed(() => store.theme() === 'light'),
    otherLocale: computed<Locale>(() => (store.locale() === 'de' ? 'en' : 'de')),
  })),
  withMethods((store) => {
    const storage = inject(StorageService);
    const transloco = inject(TranslocoService);
    return {
      setLocale(locale: Locale): void {
        patchState(store, { locale });
        storage.set('locale', locale);
        transloco.setActiveLang(locale);
      },
      toggleLocale(): void {
        this.setLocale(store.locale() === 'de' ? 'en' : 'de');
      },
      setTheme(theme: Theme): void {
        patchState(store, { theme });
        storage.set('theme', theme);
      },
      toggleTheme(): void {
        this.setTheme(store.theme() === 'dark' ? 'light' : 'dark');
      },
      openCart(): void {
        patchState(store, { cartOpen: true });
      },
      closeCart(): void {
        patchState(store, { cartOpen: false });
      },
      openPalette(): void {
        patchState(store, { paletteOpen: true, cartOpen: false });
      },
      closePalette(): void {
        patchState(store, { paletteOpen: false });
      },
      togglePalette(): void {
        patchState(store, { paletteOpen: !store.paletteOpen() });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const storage = inject(StorageService);
      const platform = inject(PlatformService);
      const transloco = inject(TranslocoService);

      // Hydrate from previous session; fall back to system preference for theme.
      const locale = storage.get<Locale>('locale', 'de');
      const theme = storage.get<Theme>(
        'theme',
        platform.prefersDark() ? 'dark' : 'light',
      );
      patchState(store, { locale, theme });
      transloco.setActiveLang(locale);

      // Reflect state into the DOM (theme class + <html lang>). Browser only.
      if (platform.isBrowser) {
        effect(() => {
          const root = document.documentElement;
          root.classList.toggle('light', store.theme() === 'light');
          root.setAttribute('lang', store.locale());
        });
      }
    },
  }),
);
