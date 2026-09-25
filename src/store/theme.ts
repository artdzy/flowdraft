import { create } from 'zustand';
import { t } from '../i18n';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'flowdraft:theme';
const media = window.matchMedia('(prefers-color-scheme: light)');

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Storage unavailable: follow the system.
  }
  return 'system';
}

const resolve = (pref: ThemePref): Theme => (pref === 'system' ? (media.matches ? 'light' : 'dark') : pref);

function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f5f3' : '#111111');
}

type ThemeState = { pref: ThemePref; theme: Theme; setPref: (pref: ThemePref) => void };

export const useTheme = create<ThemeState>()((set) => {
  const pref = readPref();
  return {
    pref,
    theme: resolve(pref),
    setPref: (next) => {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Per-device convenience only.
      }
      const theme = resolve(next);
      apply(theme);
      set({ pref: next, theme });
    },
  };
});

/** Applies the stored theme before first render and follows OS changes while on "system". */
export function initTheme() {
  apply(useTheme.getState().theme);
  media.addEventListener('change', () => {
    const { pref } = useTheme.getState();
    if (pref !== 'system') return;
    const theme = resolve(pref);
    apply(theme);
    useTheme.setState({ theme });
  });
}

export const THEME_LABEL: Record<ThemePref, string> = {
  system: t('Sistem', 'System'),
  light: t('Açık', 'Light'),
  dark: t('Koyu', 'Dark'),
};
