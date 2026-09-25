import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthModal } from '../components/AuthModal';
import { Credit } from '../components/Credit';
import { Logo } from '../components/TopBar';
import { lang, t } from '../i18n';
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
const SIGN_IN_REASON = t(
  'Bir AI aracı flowdraft hesabına bağlanmak istiyor. Devam etmek için giriş yap.',
  'An AI tool wants to connect to your flowdraft account. Sign in to continue.',
);

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function describe(message: string) {
  const m = message.toLowerCase();
  if (m.includes('expired') || m.includes('not found'))
    return t(
      'Bu bağlantı isteğinin süresi dolmuş. AI aracından yeniden bağlanmayı dene.',
      'This connection request has expired. Try connecting again from your AI tool.',
    );
  if (m.includes('failed to fetch') || m.includes('network'))
    return t('Bağlantı kurulamadı. İnternetini kontrol et.', 'Couldn’t connect. Check your internet connection.');
  return t(`Bağlantı isteği işlenemedi: ${message}`, `Couldn’t process the connection request: ${message}`);
}

function Decision({ details, onRedirect }: { details: OAuthAuthorizationDetails; onRedirect: (url: string) => void }) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState('');
  const name = details.client.name || t('Bir uygulama', 'An app');
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
        {lang === 'tr' ? (
          <>
            <strong>{name}</strong> flowdraft hesabına bağlanmak istiyor
          </>
        ) : (
          <>
            <strong>{name}</strong> wants to connect to your flowdraft account
          </>
        )}
      </h1>
      <dl className="fd-oauth-meta">
        <div>
          <dt>{t('Hesap', 'Account')}</dt>
          <dd>{details.user.email}</dd>
        </div>
        <div>
          <dt>{t('Dönüş adresi', 'Redirect URL')}</dt>
          <dd>{hostOf(details.redirect_uri)}</dd>
        </div>
        {details.client.uri && (
          <div>
            <dt>{t('Uygulama', 'App')}</dt>
            <dd>{hostOf(details.client.uri)}</dd>
          </div>
        )}
      </dl>
      <p className="fd-oauth-lead">{t('İzin verirsen bu uygulama:', 'If you allow it, this app can:')}</p>
      <ul className="fd-oauth-perms">
        <li>{t('Kayıtlı akışlarını listeleyip okuyabilir', 'List and read your saved flows')}</li>
        <li>
          {t(
            'Yeni akış oluşturabilir, mevcut akışlarını değiştirebilir ve silebilir',
            'Create new flows, and change or delete your existing ones',
          )}
        </li>
        {scopes.includes('email') && <li>{t('E-posta adresini görebilir', 'See your email address')}</li>}
        {scopes.includes('profile') && <li>{t('Profil bilgilerini görebilir', 'See your profile info')}</li>}
      </ul>
      <p className="fd-muted fd-small">
        {t(
          "Şifreni göremez. Sadece güvendiğin uygulamalara izin ver; dönüş adresi kullandığın AI aracına ait olmalı (ör. claude.ai, chatgpt.com). İzni istediğin zaman flowdraft'ta Dosya → AI araçlarına bağla bölümünden kaldırabilirsin.",
          'It can’t see your password. Only allow apps you trust; the redirect URL should belong to the AI tool you’re using (e.g. claude.ai, chatgpt.com). You can revoke access anytime in flowdraft under File → Connect AI tools.',
        )}
      </p>
      {error && (
        <p className="fd-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="fd-oauth-actions">
        <button type="button" className="fd-btn" onClick={() => void decide(false)} disabled={!!busy}>
          {busy === 'deny' && <LoaderCircle size={16} className="fd-spin" />} {t('Reddet', 'Deny')}
        </button>
        <button type="button" className="fd-btn is-primary" onClick={() => void decide(true)} disabled={!!busy}>
          {busy === 'approve' && <LoaderCircle size={16} className="fd-spin" />} {t('İzin ver', 'Allow')}
        </button>
      </div>
      <button type="button" className="fd-link fd-small" onClick={() => void signOut()} disabled={!!busy}>
        {t('Başka bir hesapla devam et', 'Continue with a different account')}
      </button>
    </>
  );
}

export function ConsentPage() {
  const ready = useAuth((s) => s.ready);
  const userId = useAuth((s) => s.user?.id);
  const [view, setView] = useState<View>(
    authorizationId
      ? { kind: 'loading' }
      : {
          kind: 'error',
          message: t(
            'Geçersiz bağlantı isteği. AI aracından yeniden bağlanmayı dene.',
            'Invalid connection request. Try connecting again from your AI tool.',
          ),
        },
  );

  useEffect(() => {
    document.title = t('Bağlantı izni · flowdraft', 'Authorize connection · flowdraft');
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
        <h1 id="fd-oauth-title">{t('Bağlantı kurulamadı', 'Couldn’t connect')}</h1>
        <p className="fd-form-error">{view.message}</p>
      </>
    );
  } else if (!ready || view.kind === 'redirecting' || (userId && view.kind === 'loading')) {
    body = (
      <>
        <h1 id="fd-oauth-title">{t('Bağlantı izni', 'Authorize connection')}</h1>
        <p className="fd-muted fd-loading">
          <LoaderCircle size={16} className="fd-spin" />{' '}
          {view.kind === 'redirecting' ? t('Yönlendiriliyor…', 'Redirecting…') : t('Yükleniyor…', 'Loading…')}
        </p>
      </>
    );
  } else if (!userId) {
    body = (
      <>
        <h1 id="fd-oauth-title">{t("AI aracını flowdraft'a bağla", 'Connect an AI tool to flowdraft')}</h1>
        <p className="fd-muted">{SIGN_IN_REASON}</p>
        <button type="button" className="fd-btn is-primary is-block" onClick={() => openAuth('login', SIGN_IN_REASON)}>
          {t('Giriş yap', 'Sign in')}
        </button>
      </>
    );
  } else if (view.kind === 'ask') {
    body = <Decision details={view.details} onRedirect={redirect} />;
  }

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-oauth-home" aria-label={t('flowdraft ana sayfa', 'flowdraft home')}>
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
