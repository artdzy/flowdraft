import type { OAuthGrant } from '@supabase/supabase-js';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { lang, locale, t } from '../i18n';
import { checkAiLink, clearLiveCanvas, useLive } from '../lib/live';
import { supabase } from '../lib/supabase';
import { openAuth, useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { askConfirm, toast, useUi } from '../store/ui';
import { CopyField, mcpUrl } from './Copy';
import { Switch } from './fields';
import { Modal } from './Modal';

const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });

function connectedOn(iso: string) {
  const date = dateFmt.format(new Date(iso));
  return t(`${date} tarihinde bağlandı`, `Connected on ${date}`);
}

function ConnectedApps() {
  const user = useAuth((s) => s.user);
  const [grants, setGrants] = useState<OAuthGrant[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    let alive = true;
    void supabase.auth.oauth.listGrants().then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setError(t('Bağlı uygulamalar şu an yüklenemedi.', 'Couldn’t load your connected apps right now.'));
      else {
        setGrants(data);
        useLive.setState({ aiConnected: data.length > 0 });
      }
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const revoke = async (grant: OAuthGrant) => {
    if (!supabase) return;
    const ok = await askConfirm({
      title: t('Erişimi kaldır', 'Remove access'),
      message: t(
        `${grant.client.name || 'Bu uygulama'} artık akışlarına erişemesin mi?`,
        `Remove ${grant.client.name || 'this app'}’s access to your flows?`,
      ),
      confirmLabel: t('Erişimi kaldır', 'Remove access'),
    });
    if (!ok) return;
    setBusyId(grant.client.id);
    const { error: err } = await supabase.auth.oauth.revokeGrant({ clientId: grant.client.id });
    setBusyId(null);
    if (err) {
      toast(t('Erişim kaldırılamadı. Tekrar dene.', 'Couldn’t remove access. Try again.'), 'error');
      return;
    }
    setGrants((list) => list?.filter((g) => g.client.id !== grant.client.id) ?? null);
    void checkAiLink(true);
    toast(t('Erişim kaldırıldı', 'Access removed'));
  };

  let body;
  if (!user) {
    body =
      lang === 'tr' ? (
        <p className="fd-muted fd-small">
          Bağladığın uygulamaları görmek için{' '}
          <button type="button" className="fd-link" onClick={() => openAuth('login')}>
            giriş yap
          </button>
          .
        </p>
      ) : (
        <p className="fd-muted fd-small">
          <button type="button" className="fd-link" onClick={() => openAuth('login')}>
            Sign in
          </button>{' '}
          to see the apps you’ve connected.
        </p>
      );
  } else if (error) {
    body = <p className="fd-muted fd-small">{error}</p>;
  } else if (!grants) {
    body = (
      <p className="fd-muted fd-loading fd-small">
        <LoaderCircle size={14} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
      </p>
    );
  } else if (!grants.length) {
    body = <p className="fd-muted fd-small">{t('Henüz bağlı bir AI aracı yok.', 'No AI tools connected yet.')}</p>;
  } else {
    body = (
      <ul className="fd-projects">
        {grants.map((g) => (
          <li key={g.client.id} className="fd-grant">
            <span className="fd-grant-main">
              <span className="fd-project-title">{g.client.name || t('Adsız uygulama', 'Untitled app')}</span>
              <span className="fd-project-date">{connectedOn(g.granted_at)}</span>
            </span>
            <button type="button" className="fd-btn is-danger" onClick={() => void revoke(g)} disabled={busyId === g.client.id}>
              {busyId === g.client.id && <LoaderCircle size={14} className="fd-spin" />} {t('Erişimi kaldır', 'Remove access')}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="fd-ai-section" aria-labelledby="fd-ai-apps">
      <h3 id="fd-ai-apps">{t('Bağlı uygulamalar', 'Connected apps')}</h3>
      {body}
    </section>
  );
}

const REVIEW_PROMPT = t('flowdraft’ta açık olan akışımı kritik et', 'Review the flow I have open in flowdraft');

/** Lets connected AI tools see the open canvas and pin their review on it (src/lib/live.ts, get_open_diagram, add_review). */
function ScreenReview() {
  const share = useSettings((s) => s.shareCanvas);
  const setShare = (on: boolean) => {
    useSettings.getState().setShareCanvas(on);
    if (!on) void clearLiveCanvas();
  };
  return (
    <section className="fd-ai-section" aria-labelledby="fd-ai-review">
      <h3 id="fd-ai-review">{t('Ekrandaki akışı kritik ettir', 'Get the flow on your screen reviewed')}</h3>
      <p className="fd-muted fd-small">
        {t(
          'Bağlı AI aracı burada açık olan akışı (kaydedilmemiş değişiklikler dahil) ve küçük bir görselini görebilir. Sohbette şunu yaz; kritik burada, ilgili adımların yanında belirir. Düzeltmesini istersen akış da ekranında güncellenir.',
          'A connected AI tool can see the flow open here, unsaved changes included, plus a small picture of it. Ask this in the chat; the review shows up right here, next to the steps it is about. Ask it to fix things and the flow updates on your screen too.',
        )}
      </p>
      <CopyField value={REVIEW_PROMPT} labelId="fd-ai-review" />
      <Switch label={t('Açık akışı bağlı AI araçlarıyla paylaş', 'Share the open flow with connected AI tools')} checked={share} onChange={setShare} />
    </section>
  );
}

function AiConnect() {
  const url = mcpUrl();
  return (
    <>
      <p className="fd-ai-lead">
        {t(
          "flowdraft'ı ChatGPT, Claude ya da MCP destekleyen başka bir AI aracına ekle. Sohbette “bana bir akış çiz” de; akış hesabına kaydedilir, buradan açıp düzenlersin. AI aracı mevcut akışlarını da okuyup güncelleyebilir.",
          'Add flowdraft to ChatGPT, Claude or any other AI tool that supports MCP. Say “draw me a flow” in the chat; the flow is saved to your account, and you can open and edit it here. The AI tool can also read and update your existing flows.',
        )}
      </p>
      <div className="fd-field">
        <span className="fd-field-label" id="fd-ai-url-label">
          {t('Sunucu adresi (MCP)', 'Server address (MCP)')}
        </span>
        <CopyField value={url} labelId="fd-ai-url-label" />
      </div>
      <p className="fd-ai-lead">
        {t(
          'Adresi AI aracının bağlayıcı (connector) ayarına ekle; açılan sayfada flowdraft hesabınla giriş yapıp izin ver. AI aracı sadece senin akışlarına erişir, şifreni görmez.',
          'Add the address to your AI tool’s connector settings, then sign in with your flowdraft account on the page that opens and allow access. The AI tool can only reach your flows and never sees your password.',
        )}
      </p>
      <a className="fd-btn is-block" href="/mcp" target="_blank" rel="noopener">
        {t('Claude, ChatGPT, Cursor… için adım adım rehber', 'Step-by-step guide for Claude, ChatGPT, Cursor…')}{' '}
        <ArrowUpRight size={15} />
      </a>
      <ScreenReview />
      <ConnectedApps />
    </>
  );
}

export function AiDialog() {
  const open = useUi((s) => s.aiOpen);
  const close = () => useUi.setState({ aiOpen: false });
  return (
    <Modal open={open} onClose={close} title={t('AI araçlarına bağla', 'Connect AI tools')} titleId="fd-ai-title">
      <AiConnect />
    </Modal>
  );
}
