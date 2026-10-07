import { lang, type Lang } from '../i18n';
import { nativeApp, siteOrigin } from './platform';

/** The server-rendered guide pages (seo/guides/*.json), by language. */
const GUIDES: Record<Lang, { what: string; examples: string; symbols: string; ai: string }> = {
  tr: {
    what: '/akis-diyagrami',
    examples: '/akis-diyagrami-ornekleri',
    symbols: '/akis-diyagrami-sembolleri',
    ai: '/yapay-zeka-ile-akis-diyagrami',
  },
  en: {
    what: '/what-is-a-flowchart',
    examples: '/flowchart-examples',
    symbols: '/flowchart-symbols',
    ai: '/chatgpt-flowchart',
  },
};

/**
 * Link to a guide page in the interface language. Inside the iPad app the pages aren't in the bundle, so the link
 * points at flowdraft.tech, which the app opens in the browser.
 */
export function guideHref(guide: keyof (typeof GUIDES)['tr']) {
  const path = GUIDES[lang][guide];
  return nativeApp ? siteOrigin + path : path;
}
