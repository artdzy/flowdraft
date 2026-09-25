import { t } from '../i18n';
import { nativeApp } from '../lib/platform';
import { useTheme } from '../store/theme';

const YEAR = new Date().getFullYear();

/** websiteniyapalım.com standard footer badge, light or dark to match the app theme. */
export function Credit() {
  const theme = useTheme((s) => s.theme);
  return (
    <div className="wsy-credit" data-theme={theme}>
      <span className="wsy-credit__copy">
        © {YEAR} flowdraft · {t('Tüm hakları saklıdır.', 'All rights reserved.')} ·{' '}
        <a href="/kullanim-sartlari">{t('Kullanım Şartları', 'Terms of Use')}</a> ·{' '}
        <a href="/gizlilik">{t('Gizlilik', 'Privacy')}</a> · <a href="/destek">{t('Destek', 'Support')}</a> ·{' '}
        <a href="/mcp">{t('Yapay zekâ ile kullan', 'Use with AI')}</a>
        {/* The promo videos are web-only (not bundled into the iPad app). */}
        {!nativeApp && (
          <>
            {' '}
            · <a href="/tanitim">{t('Tanıtım', 'Product tour')}</a>
          </>
        )}
      </span>
      <a
        className="wsy-credit__link"
        href="https://websiteniyapalim.com/?utm_source=flowdraft&utm_medium=footer&utm_campaign=rozet"
        target="_blank"
        rel="noopener"
        title={t('Bu site Web Siteni Yapalım tarafından hazırlandı', 'This site was made by Web Siteni Yapalım')}
      >
        <span className="wsy-credit__dot" aria-hidden="true" />
        <span>
          {t('Tasarım:', 'Design:')} websiteniyapalım<b className="wsy-credit__tld">.com</b>
        </span>
      </a>
    </div>
  );
}
