import { lang, setLang, t, type Lang } from '../i18n';

export const LANGS: { value: Lang; code: string; name: string }[] = [
  { value: 'tr', code: 'TR', name: 'Türkçe' },
  { value: 'en', code: 'EN', name: 'English' },
];

/** Compact TR / EN switch; the page reloads in the chosen language and keeps it on this device. */
export function LangSwitch() {
  return (
    <div className="fd-segmented fd-lang" role="group" aria-label={t('Dil', 'Language')}>
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          lang={l.value}
          title={l.name}
          aria-label={l.name}
          aria-pressed={lang === l.value}
          className={lang === l.value ? 'is-on' : ''}
          onClick={() => setLang(l.value)}
        >
          {l.code}
        </button>
      ))}
    </div>
  );
}
