import { useState } from 'react';
import { t } from '../i18n';
import { nativeApp } from '../lib/platform';
import { PromoVideo } from '../promo/PromoPage';
import { useUi } from '../store/ui';
import { Modal } from './Modal';

const HIDE_KEY = 'flowdraft:promo:hidden';
const SEEN_KEY = 'flowdraft:promo:seen';

/**
 * Shown once per browser session until the viewer ticks "don't show again". Skipped in the iPad app (the videos
 * are web-only), for ?p= project links and when storage is blocked, since the choice couldn't be remembered.
 */
function shouldShow(): boolean {
  if (nativeApp || new URLSearchParams(window.location.search).has('p')) return false;
  try {
    return !localStorage.getItem(HIDE_KEY) && !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

// Decided once at load, before the first render, so the what's-new dialog knows to wait for this one.
useUi.setState({ promoOpen: shouldShow() });

export function PromoDialog() {
  const open = useUi((s) => s.promoOpen);
  const [hide, setHide] = useState(false);

  const close = () => {
    useUi.setState({ promoOpen: false });
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
      if (hide) localStorage.setItem(HIDE_KEY, '1');
    } catch {
      // Storage was checked before opening; nothing more to do.
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('flowdraft’a hoş geldin', 'Welcome to flowdraft')}
      titleId="fd-promo-dialog-title"
      className="fd-promo-modal"
    >
      <PromoVideo />
      <div className="fd-promo-modal-foot">
        <label className="fd-consent">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          <span>{t('Bir daha gösterme', 'Don’t show this again')}</span>
        </label>
        <button type="button" className="fd-btn is-primary" onClick={close}>
          {t('Çizmeye başla', 'Start drawing')}
        </button>
      </div>
    </Modal>
  );
}
