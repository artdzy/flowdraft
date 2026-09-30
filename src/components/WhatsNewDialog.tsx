import { MessageSquare, RefreshCw, Wrench, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { version } from '../../package.json';
import { t } from '../i18n';
import { useUi } from '../store/ui';
import { Modal } from './Modal';

const SEEN_KEY = 'flowdraft:whatsnew';

type Change = { icon: LucideIcon; title: string; text: string };

/** What this version brings. Update together with the version in package.json; everyone sees it once. */
const CHANGES: Change[] = [
  {
    icon: MessageSquare,
    title: t('Sohbetten çiz, sohbette gör', 'Draw from the chat, see it in the chat'),
    text: t(
      'flowdraft’ı Claude, ChatGPT ya da Codex’e bağladıysan AI akışı çizdiğinde veya değiştirdiğinde sonucun görseli sohbete gelir. Düzeltmeni sohbete yaz; AI aynı akışı günceller ve yeni görseli gösterir. flowdraft’ı açman bile gerekmez.',
      'If you’ve connected flowdraft to Claude, ChatGPT or Codex, a picture of the result shows up in the chat whenever the AI draws or changes a flow. Type your corrections in the chat; the AI updates the same flow and shows the new picture. You don’t even need to open flowdraft.',
    ),
  },
  {
    icon: RefreshCw,
    title: t('Değişiklikler ekrana canlı gelir', 'Changes appear live'),
    text: t(
      'AI açık olan akışını değiştirdiğinde flowdraft sayfayı yenilemeden son hali gösterir. AI, burada açık olan akışı da görebilir; istersen Dosya → AI araçlarına bağla altından kapatabilirsin.',
      'When the AI changes the flow you have open, flowdraft shows the latest version without a reload. The AI can also see the flow open here; you can turn that off under File → Connect AI tools.',
    ),
  },
  {
    icon: Wrench,
    title: t('Düzeltme', 'Fix'),
    text: t(
      'Karar kutuları PNG ve SVG dışa aktarımında artık siyah çıkmıyor.',
      'Decision diamonds no longer come out black in PNG and SVG exports.',
    ),
  },
];

/** Not in a ?p= link someone followed from an AI tool, and not when the choice couldn't be remembered. */
function unseen(): boolean {
  if (new URLSearchParams(window.location.search).has('p')) return false;
  try {
    return localStorage.getItem(SEEN_KEY) !== version;
  } catch {
    return false;
  }
}

/** Version and change list, shown once per person (per browser) after the welcome video, in TR or EN. */
export function WhatsNewDialog() {
  const [pending, setPending] = useState(unseen);
  const promoOpen = useUi((s) => s.promoOpen);

  const close = () => {
    setPending(false);
    try {
      localStorage.setItem(SEEN_KEY, version);
    } catch {
      // Storage was checked before opening; nothing more to do.
    }
  };

  const connect = () => {
    close();
    useUi.setState({ aiOpen: true });
  };

  return (
    <Modal
      open={pending && !promoOpen}
      onClose={close}
      title={t(`Yenilikler · v${version}`, `What’s new · v${version}`)}
      titleId="fd-whatsnew-title"
      className="fd-whatsnew-modal"
    >
      <ul className="fd-whatsnew">
        {CHANGES.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <span className="fd-whatsnew-icon" aria-hidden>
              <Icon size={17} strokeWidth={1.9} />
            </span>
            <span className="fd-whatsnew-body">
              <strong>{title}</strong>
              <span>{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="fd-whatsnew-foot">
        <button type="button" className="fd-btn" onClick={connect}>
          {t('AI araçlarına bağla', 'Connect AI tools')}
        </button>
        <button type="button" className="fd-btn is-primary" onClick={close}>
          {t('Tamam', 'Got it')}
        </button>
      </div>
    </Modal>
  );
}
