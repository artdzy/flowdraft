export type Lang = 'tr' | 'en';

function detect(): Lang {
  // The MCP server (server/mcp.ts) shares the node defaults and keeps its original Turkish ones.
  if (typeof window === 'undefined') return 'tr';
  const first = navigator.languages?.[0] ?? navigator.language ?? '';
  return first.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

/** Turkish on Turkish devices and browsers, English everywhere else. Fixed for the page's lifetime. */
export const lang: Lang = detect();

/** BCP 47 locale for dates, case mapping and sorting in the current language. */
export const locale = lang === 'tr' ? 'tr-TR' : 'en-US';

/** Picks the text for the current language; both versions live next to the code that shows them. */
export function t(tr: string, en: string): string {
  return lang === 'tr' ? tr : en;
}

/** Default name for a diagram nobody has named yet. */
export const UNTITLED = t('Adsız akış', 'Untitled flow');
