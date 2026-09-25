import { ArrowRight, Cloud, Download, Plug, Shapes, Spline, Zap } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Credit } from '../components/Credit';
import { Logo } from '../components/TopBar';
import { t } from '../i18n';
import { GUIDE_PATH } from '../guide/McpGuidePage';

/** Public promo page with the 30 s product video (public/promo, made with ft-motion). */
export const PROMO_PATH = '/tanitim';

export function isPromoPath(pathname: string) {
  return pathname.replace(/\/+$/, '') === PROMO_PATH;
}

// Tall phones get the 9:16 cut; everything else the 16:9 one.
const PORTRAIT_QUERY = '(max-width: 760px) and (orientation: portrait)';

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Zap size={18} />,
    title: t('Hemen başla', 'Start right away'),
    text: t(
      'Hesap açmadan kullan; çizimin bu cihazda taslak olarak saklanır.',
      'No account needed; your drawing is kept on this device as a draft.',
    ),
  },
  {
    icon: <Shapes size={18} />,
    title: t('Hazır parçalar', 'Ready-made parts'),
    text: t(
      'Adım, karar, insan onayı, kişi, bot, veritabanı, not ve kulvarlar.',
      'Steps, decisions, human approval, people, bots, databases, notes and lanes.',
    ),
  },
  {
    icon: <Spline size={18} />,
    title: t('Her bağlantıya stil', 'Style every connection'),
    text: t(
      'Düz, kesikli ya da noktalı; 6 renk; köşeli, eğri ya da düz yol; akış animasyonu ve etiket.',
      'Solid, dashed or dotted; 6 colors; stepped, curved or straight; flow animation and labels.',
    ),
  },
  {
    icon: <Download size={18} />,
    title: t('Dışa aktar', 'Export'),
    text: t('PNG görsel, SVG vektör ya da düzenlenebilir JSON.', 'PNG image, SVG vector or editable JSON.'),
  },
  {
    icon: <Plug size={18} />,
    title: t('Yapay zekâ ile kullan', 'Use it with AI'),
    text: t(
      'Hesabını ChatGPT, Claude gibi MCP destekleyen bir araca bağla; akışı senin yerine çizsin.',
      'Connect your account to ChatGPT, Claude or another MCP tool and let it draw the flow for you.',
    ),
  },
  {
    icon: <Cloud size={18} />,
    title: t('Buluta kaydet', 'Save to the cloud'),
    text: t(
      'Ücretsiz hesapla projelerini kaydet, otomatik kaydetmeyi aç.',
      'Save your projects with a free account and turn on auto-save.',
    ),
  },
];

function usePortrait() {
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY);
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return portrait;
}

export function PromoVideo() {
  const portrait = usePortrait();
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cut = portrait ? '9x16' : '16x9';
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // React sets `muted` only as a property; iOS Safari wants the attribute before it allows muted autoplay.
    v.defaultMuted = true;
    v.muted = true;
    v.setAttribute('muted', '');
    if (!still) v.play().catch(() => {});
  }, [cut, still]);
  return (
    <figure className={`fd-promo-video is-${cut}`}>
      {/* key: swap the whole element when the cut changes so the new source loads */}
      <video
        key={cut}
        ref={ref}
        src={`/promo/flowdraft-${cut}.mp4`}
        poster={`/promo/flowdraft-${cut}.jpg`}
        width={portrait ? 1080 : 1920}
        height={portrait ? 1920 : 1080}
        autoPlay={!still}
        muted
        loop
        playsInline
        controls
        preload={still ? 'none' : 'auto'}
        aria-label={t('flowdraft tanıtım videosu (30 saniye)', 'flowdraft product video (30 seconds)')}
      />
      <figcaption className="fd-muted fd-small">
        {t('30 saniyelik tanıtım · ses için hoparlör simgesine dokun', '30-second tour · tap the speaker icon for sound')}
      </figcaption>
    </figure>
  );
}

export function PromoPage() {
  useEffect(() => {
    document.title = t('flowdraft · Fikirden akışa', 'flowdraft · From idea to flow');
  }, []);

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-oauth-home" aria-label={t('flowdraft ana sayfa', 'flowdraft home')}>
          <Logo />
        </a>
        <a href="/" className="fd-btn is-primary">
          {t('Uygulamayı aç', 'Open the app')} <ArrowRight size={16} />
        </a>
      </header>

      <main className="fd-promo">
        <section className="fd-promo-hero" aria-labelledby="fd-promo-title">
          <p className="fd-guide-kicker">{t('ÜCRETSİZ AKIŞ DİYAGRAMI EDİTÖRÜ', 'FREE FLOWCHART EDITOR')}</p>
          <h1 id="fd-promo-title">{t('Fikirden akışa.', 'From idea to flow.')}</h1>
          <p className="fd-promo-lead">
            {t(
              'Sürükle, bağla, kaydet. Süreçlerini, otomasyonlarını ve konuşma akışlarını dakikalar içinde çiz. Tarayıcıda ve telefonda çalışır.',
              'Drag, connect, save. Map processes, automations and conversations in minutes. Works in your browser and on your phone.',
            )}
          </p>
          <div className="fd-promo-actions">
            <a href="/" className="fd-btn is-primary fd-promo-cta">
              {t('Hemen çizmeye başla', 'Start drawing')} <ArrowRight size={17} />
            </a>
            <a href={GUIDE_PATH} className="fd-btn fd-promo-cta">
              <Plug size={16} /> {t('Yapay zekâ ile kullan', 'Use with AI')}
            </a>
          </div>
        </section>

        <PromoVideo />

        <ul className="fd-guide-features fd-promo-features" aria-label={t('Özellikler', 'Features')}>
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="fd-guide-feature-icon" aria-hidden>
                {f.icon}
              </span>
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        <section className="fd-promo-end" aria-labelledby="fd-promo-end-title">
          <h2 id="fd-promo-end-title">{t('Ücretsiz. Hesap açmadan başla.', 'Free. No account needed to start.')}</h2>
          <a href="/" className="fd-btn is-primary fd-promo-cta">
            {t('flowdraft’ı aç', 'Open flowdraft')} <ArrowRight size={17} />
          </a>
        </section>
      </main>
      <Credit />
    </div>
  );
}
