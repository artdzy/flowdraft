const YEAR = new Date().getFullYear();

/** websiteniyapalım.com standard footer badge (dark variant). */
export function Credit() {
  return (
    <div className="wsy-credit" data-theme="dark">
      <span className="wsy-credit__copy">
        © {YEAR} flowdraft · Tüm hakları saklıdır. · <a href="/kullanim-sartlari">Kullanım Şartları</a> ·{' '}
        <a href="/gizlilik">Gizlilik</a>
      </span>
      <a
        className="wsy-credit__link"
        href="https://websiteniyapalim.com/?utm_source=flowdraft&utm_medium=footer&utm_campaign=rozet"
        target="_blank"
        rel="noopener"
        title="Bu site Web Siteni Yapalım tarafından hazırlandı"
      >
        <span className="wsy-credit__dot" aria-hidden="true" />
        <span>
          Tasarım: websiteniyapalım<b className="wsy-credit__tld">.com</b>
        </span>
      </a>
    </div>
  );
}
