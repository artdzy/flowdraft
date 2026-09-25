import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthModal } from '../components/AuthModal';
import { Credit } from '../components/Credit';
import { Logo } from '../components/TopBar';
import { supabase } from '../lib/supabase';
import { openAuth, signOut, useAuth } from '../store/auth';

/** Supabase Auth sends users here (Site URL + authorization path) when an AI tool asks to connect over MCP. */
export const CONSENT_PATH = '/oauth/consent';

export function isConsentPath(pathname: string) {
  return pathname.replace(/\/+$/, '') === CONSENT_PATH;
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ask'; details: OAuthAuthorizationDetails }
  | { kind: 'redirecting' };

const authorizationId = new URLSearchParams(window.location.search).get('authorization_id');
const SIGN_IN_REASON = 'Bir AI aracı flowdraft hesabına bağlanmak istiyor. Devam etmek için giriş yap.';

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function describe(message: string) {
  const m = message.toLowerCase();
  if (m.includes('expired') || m.includes('not found')) return 'Bu bağlantı isteğinin süresi dolmuş. AI aracından yeniden bağlanmayı dene.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Bağlantı kurulamadı. İnternetini kontrol et.';
  return `Bağlantı isteği işlenemedi: ${message}`;
}

function Decision({ details, onRedirect }: { details: OAuthAuthorizationDetails; onRedirect: (url: string) => void }) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState('');
  const name = details.client.name || 'Bir uygulama';
  const scopes = details.scope.split(' ');

  const decide = async (approve: boolean) => {
    if (!supabase) return;
    setBusy(approve ? 'approve' : 'deny');
    setError('');
    const oauth = supabase.auth.oauth;
    const { data, error: err } = approve
      ? await oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
      : await oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });
    if (err) {
      setBusy(null);
      setError(describe(err.message));
      return;
    }
    onRedirect(data.redirect_url);
  };

  return (
    <>
      <span className="fd-oauth-badge" aria-hidden>
        <ShieldCheck size={22} />
      </span>
      <h1 id="fd-oauth-title">
        <strong>{name}</strong> flowdraft hesabına bağlanmak istiyor
      </h1>
      <dl className="fd-oauth-meta">
        <div>
          <dt>Hesap</dt>
          <dd>{details.user.email}</dd>
        </div>
        <div>
          <dt>Dönüş adresi</dt>
          <dd>{hostOf(details.redirect_uri)}</dd>
        </div>
        {details.client.uri && (
          <div>
            <dt>Uygulama</dt>
            <dd>{hostOf(details.client.uri)}</dd>
          </div>
        )}
      </dl>
      <p className="fd-oauth-lead">İzin verirsen bu uygulama:</p>
      <ul className="fd-oauth-perms">
        <li>Kayıtlı akışlarını listeleyip okuyabilir</li>
        <li>Yeni akış oluşturabilir, mevcut akışlarını değiştirebilir ve silebilir</li>
        {scopes.includes('email') && <li>E-posta adresini görebilir</li>}
        {scopes.includes('profile') && <li>Profil bilgilerini görebilir</li>}
      </ul>
      <p className="fd-muted fd-small">
        Şifreni göremez. Sadece güvendiğin uygulamalara izin ver; dönüş adresi kullandığın AI aracına ait olmalı (ör.
        claude.ai, chatgpt.com). İzni istediğin zaman flowdraft'ta Dosya → AI araçlarına bağla bölümünden kaldırabilirsin.
      </p>
      {error && (
        <p className="fd-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="fd-oauth-actions">
        <button type="button" className="fd-btn" onClick={() => void decide(false)} disabled={!!busy}>
          {busy === 'deny' && <LoaderCircle size={16} className="fd-spin" />} Reddet
        </button>
        <button type="button" className="fd-btn is-primary" onClick={() => void decide(true)} disabled={!!busy}>
          {busy === 'approve' && <LoaderCircle size={16} className="fd-spin" />} İzin ver
        </button>
      </div>
      <button type="button" className="fd-link fd-small" onClick={() => void signOut()} disabled={!!busy}>
        Başka bir hesapla devam et
      </button>
    </>
  );
}

export function ConsentPage() {
  const ready = useAuth((s) => s.ready);
  const userId = useAuth((s) => s.user?.id);
  const [view, setView] = useState<View>(
    authorizationId ? { kind: 'loading' } : { kind: 'error', message: 'Geçersiz bağlantı isteği. AI aracından yeniden bağlanmayı dene.' },
  );

  useEffect(() => {
    document.title = 'Bağlantı izni · flowdraft';
  }, []);

  useEffect(() => {
    if (ready && !userId && authorizationId) openAuth('login', SIGN_IN_REASON);
  }, [ready, userId]);

  const redirect = (url: string) => {
    setView({ kind: 'redirecting' });
    window.location.assign(url);
  };

  useEffect(() => {
    if (!userId || !authorizationId || !supabase) return;
    let alive = true;
    setView({ kind: 'loading' });
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!alive) return;
      if (error) setView({ kind: 'error', message: describe(error.message) });
      else if ('authorization_id' in data) setView({ kind: 'ask', details: data });
      // Already approved earlier: Supabase hands back the redirect straight away.
      else redirect(data.redirect_url);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  let body;
  if (view.kind === 'error') {
    body = (
      <>
        <h1 id="fd-oauth-title">Bağlantı kurulamadı</h1>
        <p className="fd-form-error">{view.message}</p>
      </>
    );
  } else if (!ready || view.kind === 'redirecting' || (userId && view.kind === 'loading')) {
    body = (
      <>
        <h1 id="fd-oauth-title">Bağlantı izni</h1>
        <p className="fd-muted fd-loading">
          <LoaderCircle size={16} className="fd-spin" /> {view.kind === 'redirecting' ? 'Yönlendiriliyor…' : 'Yükleniyor…'}
        </p>
      </>
    );
  } else if (!userId) {
    body = (
      <>
        <h1 id="fd-oauth-title">AI aracını flowdraft'a bağla</h1>
        <p className="fd-muted">{SIGN_IN_REASON}</p>
        <button type="button" className="fd-btn is-primary is-block" onClick={() => openAuth('login', SIGN_IN_REASON)}>
          Giriş yap
        </button>
      </>
    );
  } else if (view.kind === 'ask') {
    body = <Decision details={view.details} onRedirect={redirect} />;
  }

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-oauth-home" aria-label="flowdraft ana sayfa">
          <Logo />
        </a>
      </header>
      <main className="fd-oauth">
        <section className="fd-oauth-card" aria-labelledby="fd-oauth-title" aria-busy={view.kind === 'loading'}>
          {body}
        </section>
      </main>
      <Credit />
      <AuthModal />
    </div>
  );
}
