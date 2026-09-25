import type { OAuthGrant } from '@supabase/supabase-js';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { openAuth, useAuth } from '../store/auth';
import { toast, useUi } from '../store/ui';
import { CopyField, mcpUrl } from './Copy';
import { Modal } from './Modal';

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

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
      if (err) setError('Bağlı uygulamalar şu an yüklenemedi.');
      else setGrants(data);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const revoke = async (grant: OAuthGrant) => {
    if (!supabase) return;
    if (!window.confirm(`${grant.client.name || 'Bu uygulama'} artık akışlarına erişemesin mi?`)) return;
    setBusyId(grant.client.id);
    const { error: err } = await supabase.auth.oauth.revokeGrant({ clientId: grant.client.id });
    setBusyId(null);
    if (err) {
      toast('Erişim kaldırılamadı. Tekrar dene.', 'error');
      return;
    }
    setGrants((list) => list?.filter((g) => g.client.id !== grant.client.id) ?? null);
    toast('Erişim kaldırıldı');
  };

  let body;
  if (!user) {
    body = (
      <p className="fd-muted fd-small">
        Bağladığın uygulamaları görmek için{' '}
        <button type="button" className="fd-link" onClick={() => openAuth('login')}>
          giriş yap
        </button>
        .
      </p>
    );
  } else if (error) {
    body = <p className="fd-muted fd-small">{error}</p>;
  } else if (!grants) {
    body = (
      <p className="fd-muted fd-loading fd-small">
        <LoaderCircle size={14} className="fd-spin" /> Yükleniyor…
      </p>
    );
  } else if (!grants.length) {
    body = <p className="fd-muted fd-small">Henüz bağlı bir AI aracı yok.</p>;
  } else {
    body = (
      <ul className="fd-projects">
        {grants.map((g) => (
          <li key={g.client.id} className="fd-grant">
            <span className="fd-grant-main">
              <span className="fd-project-title">{g.client.name || 'Adsız uygulama'}</span>
              <span className="fd-project-date">{dateFmt.format(new Date(g.granted_at))} tarihinde bağlandı</span>
            </span>
            <button type="button" className="fd-btn is-danger" onClick={() => void revoke(g)} disabled={busyId === g.client.id}>
              {busyId === g.client.id && <LoaderCircle size={14} className="fd-spin" />} Erişimi kaldır
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="fd-ai-section" aria-labelledby="fd-ai-apps">
      <h3 id="fd-ai-apps">Bağlı uygulamalar</h3>
      {body}
    </section>
  );
}

function AiConnect() {
  const url = mcpUrl();
  return (
    <>
      <p className="fd-ai-lead">
        flowdraft'ı ChatGPT, Claude ya da MCP destekleyen başka bir AI aracına ekle. Sohbette “bana bir akış çiz” de; akış
        hesabına kaydedilir, buradan açıp düzenlersin. AI aracı mevcut akışlarını da okuyup güncelleyebilir.
      </p>
      <div className="fd-field">
        <span className="fd-field-label" id="fd-ai-url-label">
          Sunucu adresi (MCP)
        </span>
        <CopyField value={url} labelId="fd-ai-url-label" />
      </div>
      <p className="fd-ai-lead">
        Adresi AI aracının bağlayıcı (connector) ayarına ekle; açılan sayfada flowdraft hesabınla giriş yapıp izin ver. AI
        aracı sadece senin akışlarına erişir, şifreni görmez.
      </p>
      <a className="fd-btn is-block" href="/mcp" target="_blank" rel="noopener">
        Claude, ChatGPT, Cursor… için adım adım rehber <ArrowUpRight size={15} />
      </a>
      <ConnectedApps />
    </>
  );
}

export function AiDialog() {
  const open = useUi((s) => s.aiOpen);
  const close = () => useUi.setState({ aiOpen: false });
  return (
    <Modal open={open} onClose={close} title="AI araçlarına bağla" titleId="fd-ai-title">
      <AiConnect />
    </Modal>
  );
}
