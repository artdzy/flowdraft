export type Lang = 'tr' | 'en';

const LANG_KEY = 'flowdraft:lang';

/** The saved choice as a cookie too, so the server (seo.js) writes the page's own texts in the same language. */
function tellServer(chosen: Lang) {
  document.cookie = `fd_lang=${chosen}; path=/; max-age=31536000; samesite=lax`;
}

function detect(): Lang {
  // The MCP server (server/mcp.ts) shares the node defaults and keeps its original Turkish ones.
  if (typeof window === 'undefined') return 'tr';
  // ?lang= links (hreflang alternates, sitemap) pick the language for that visit without changing the saved choice.
  const asked = new URLSearchParams(window.location.search).get('lang');
  if (asked === 'tr' || asked === 'en') return asked;
  try {
    const chosen = localStorage.getItem(LANG_KEY);
    if (chosen === 'tr' || chosen === 'en') {
      // Choices saved before the cookie existed reach the server from the next page load on.
      tellServer(chosen);
      return chosen;
    }
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  const first = navigator.languages?.[0] ?? navigator.language ?? '';
  return first.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

/**
 * The language picked with the TR / EN switch, else Turkish on Turkish devices and browsers and English
 * everywhere else. Fixed for the page's lifetime.
 */
export const lang: Lang = detect();

/** Remembers the choice on this device and reloads, since texts are picked once when the page loads. */
export function setLang(next: Lang) {
  if (next === lang) return;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    return;
  }
  tellServer(next);
  // A ?lang= in the address would override the new choice after the reload.
  const url = new URL(window.location.href);
  url.searchParams.delete('lang');
  window.location.replace(url);
}

/** BCP 47 locale for dates, case mapping and sorting in the current language. */
export const locale = lang === 'tr' ? 'tr-TR' : 'en-US';

/** Picks the text for the current language; both versions live next to the code that shows them. */
export function t(tr: string, en: string): string {
  return lang === 'tr' ? tr : en;
}

const UNTITLED_BY_LANG: Record<Lang, string> = { tr: 'Adsız akış', en: 'Untitled flow' };

/** Default name for a diagram nobody has named yet. */
export const UNTITLED = UNTITLED_BY_LANG[lang];

/** True for the default name in any language, so it follows a language switch. */
export const isUntitled = (title: string) => Object.values(UNTITLED_BY_LANG).includes(title);
