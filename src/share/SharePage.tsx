import { Eye, LoaderCircle, Lock, LogIn, PencilLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AuthModal } from '../components/AuthModal';
import { LangSwitch } from '../components/LangSwitch';
import { ReadOnlyFlow } from '../components/ReadOnlyFlow';
import { Logo } from '../components/TopBar';
import { t } from '../i18n';
import { parseDoc } from '../lib/doc';
import { describeError } from '../lib/projects';
import { openSharedFlow, type SharedView } from '../lib/share';
import { openAuth, useAuth } from '../store/auth';

const SIGN_IN_REASON = t(
  'Bu akışa eklendiysen, eklendiğin e-postayla giriş yap.',
  'If you were added to this flow, sign in with that email.',
);

type Opened = Extract<SharedView, { status: 'ok' }>;

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="fd-share-gate">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

function SignInLink() {
  const user = useAuth((s) => s.user);
  if (user)
    return (
      <p className="fd-muted fd-small">
        {t(`${user.email} hesabı bu akışa ekli değil.`, `${user.email} hasn’t been added to this flow.`)}
      </p>
    );
  return (
    <button type="button" className="fd-btn is-block" onClick={() => openAuth('login', SIGN_IN_REASON)}>
      <LogIn size={16} /> {t('Davetliysen giriş yap', 'Invited? Sign in')}
    </button>
  );
}

function PasswordGate({ error, busy, onSubmit }: { error: string; busy: boolean; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password) onSubmit(password);
  };
  return (
    <Message title={t('Bu akış şifreli', 'This flow is password protected')}>
      <form className="fd-share-form" onSubmit={submit}>
        <label className="fd-field">
          <span className="fd-field-label">{t('Şifre', 'Password')}</span>
          <input
            type="password"
            name="share-password"
            autoComplete="off"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="fd-form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="fd-btn is-primary is-block" disabled={busy || !password}>
          {busy ? <LoaderCircle size={16} className="fd-spin" /> : <Lock size={16} />} {t('Akışı aç', 'Open flow')}
        </button>
      </form>
      <SignInLink />
    </Message>
  );
}

function Viewer({ flow }: { flow: Opened }) {
  const doc = useMemo(() => parseDoc(flow.content), [flow.content]);
  if (!doc) return <Message title={t('Bu akış açılamadı.', 'This flow couldn’t be opened.')} />;
  return (
    <div className="fd-share-canvas">
      <ReadOnlyFlow doc={doc} />
    </div>
  );
}

/** A flow opened from its share link (/s/<token>). The page itself only shows it; editing happens in the editor. */
export function SharePage({ token }: { token: string }) {
  const ready = useAuth((s) => s.ready);
  const userId = useAuth((s) => s.user?.id);
  const [view, setView] = useState<SharedView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (password?: string) => {
      setBusy(true);
      setError('');
      try {
        setView(await openSharedFlow(token, password));
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  // Signing in can change what the link gives, so it opens again for the new account.
  useEffect(() => {
    if (ready) void load();
  }, [ready, userId, load]);

  const opened = view?.status === 'ok' ? view : null;

  useEffect(() => {
    document.title = opened ? `${opened.title} · flowdraft` : t('Paylaşılan akış · flowdraft', 'Shared flow · flowdraft');
  }, [opened]);

  let body;
  if (opened) body = <Viewer flow={opened} />;
  else if (view?.status === 'password' || view?.status === 'wrong_password' || view?.status === 'locked') {
    const message =
      view.status === 'wrong_password'
        ? t('Şifre yanlış.', 'Wrong password.')
        : view.status === 'locked'
          ? t('Çok fazla yanlış deneme. 15 dakika sonra tekrar dene.', 'Too many wrong attempts. Try again in 15 minutes.')
          : error;
    body = <PasswordGate error={message} busy={busy} onSubmit={(password) => void load(password)} />;
  } else if (view?.status === 'invite_only') {
    body = (
      <Message title={t('Bu akış sadece davetlilere açık', 'This flow is for invited people only')}>
        <SignInLink />
      </Message>
    );
  } else if (view?.status === 'not_found') {
    body = (
      <Message title={t('Bu link çalışmıyor', 'This link doesn’t work')}>
        <p className="fd-muted">
          {t('Paylaşım kapatılmış ya da akış silinmiş olabilir.', 'Sharing may have been stopped, or the flow was deleted.')}
        </p>
      </Message>
    );
  } else if (error) {
    body = (
      <Message title={t('Akış açılamadı', 'Couldn’t open the flow')}>
        <p className="fd-form-error">{error}</p>
      </Message>
    );
  } else {
    body = (
      <p className="fd-muted fd-loading fd-share-gate">
        <LoaderCircle size={16} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
      </p>
    );
  }

  return (
    <div className="fd-share-page">
      <header className="fd-topbar">
        <a href="/" className="fd-share-home" aria-label={t('flowdraft ana sayfa', 'flowdraft home')}>
          <Logo />
        </a>
        {opened && <span className="fd-share-title">{opened.title}</span>}
        <div className="fd-topbar-spacer" />
        {opened?.project_id ? (
          <a className="fd-btn is-primary" href={`/?p=${opened.project_id}`}>
            <PencilLine size={16} /> {t('Düzenle', 'Edit')}
          </a>
        ) : (
          opened && (
            <span className="fd-share-badge">
              <Eye size={14} aria-hidden /> {t('Salt okunur', 'Read only')}
            </span>
          )
        )}
        <LangSwitch />
        {!userId && ready && (
          <button type="button" className="fd-btn" onClick={() => openAuth('login', SIGN_IN_REASON)}>
            <LogIn size={16} /> {t('Giriş yap', 'Sign in')}
          </button>
        )}
      </header>
      <main className="fd-share-main">{body}</main>
      <AuthModal />
    </div>
  );
}
