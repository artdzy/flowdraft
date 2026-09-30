import { ArrowLeft, LoaderCircle, LogOut, ShieldCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthModal } from '../components/AuthModal';
import { Credit } from '../components/Credit';
import { ConfirmDialog, Toasts } from '../components/Dialogs';
import { LangSwitch } from '../components/LangSwitch';
import { Logo } from '../components/TopBar';
import { locale, t } from '../i18n';
import { ADMIN_PATH, PROFILE_PATH } from '../lib/admin';
import { countProjects } from '../lib/projects';
import { deleteAccount, openAuth, signOut, useAuth } from '../store/auth';
import { askConfirm, toast } from '../store/ui';

export function isProfilePath(pathname: string) {
  return pathname.replace(/\/+$/, '') === PROFILE_PATH;
}

const SIGN_IN_REASON = t('Profilini görmek için giriş yap.', 'Sign in to see your profile.');
const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });

function Account({ email, createdAt, admin }: { email: string; createdAt: string; admin: boolean }) {
  const [flows, setFlows] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    countProjects().then(setFlows, () => setFlows(null));
  }, []);

  const leave = async () => {
    await signOut();
    window.location.assign('/');
  };

  const remove = async () => {
    const ok = await askConfirm({
      title: t('Hesabı sil', 'Delete account'),
      message: t(
        'Hesabın ve kayıtlı tüm projelerin kalıcı olarak silinsin mi? Bu işlem geri alınamaz. Tuvaldeki çizim bu cihazda kalır.',
        'Permanently delete your account and all your saved projects? This can’t be undone. The drawing on your canvas stays on this device.',
      ),
      confirmLabel: t('Hesabı sil', 'Delete account'),
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAccount();
      window.location.assign('/');
    } catch {
      setDeleting(false);
      toast(
        t('Hesap silinemedi. Biraz sonra tekrar dene.', 'Couldn’t delete your account. Try again in a little while.'),
        'error',
      );
    }
  };

  return (
    <>
      <h1>{t('Profil', 'Profile')}</h1>

      <section className="fd-profile-card" aria-labelledby="fd-profile-account">
        <h2 id="fd-profile-account">{t('Hesap', 'Account')}</h2>
        <dl className="fd-profile-meta">
          <div>
            <dt>{t('E-posta', 'Email')}</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>{t('Üyelik', 'Member since')}</dt>
            <dd>{dateFmt.format(new Date(createdAt))}</dd>
          </div>
          <div>
            <dt>{t('Kayıtlı akış', 'Saved flows')}</dt>
            <dd>{flows ?? '—'}</dd>
          </div>
        </dl>
        <div className="fd-profile-actions">
          <button type="button" className="fd-btn" onClick={() => void leave()} disabled={deleting}>
            <LogOut size={16} /> {t('Çıkış yap', 'Sign out')}
          </button>
          {admin && (
            <a href={ADMIN_PATH} className="fd-btn">
              <ShieldCheck size={16} /> {t('Yönetim paneli', 'Admin panel')}
            </a>
          )}
        </div>
      </section>

      <section className="fd-profile-card is-danger" aria-labelledby="fd-profile-danger">
        <h2 id="fd-profile-danger">{t('Hesabı sil', 'Delete account')}</h2>
        <p className="fd-muted">
          {t(
            'Hesabın ve kayıtlı tüm projelerin hemen ve kalıcı olarak silinir. Bu işlem geri alınamaz.',
            'Your account and all your saved projects are deleted immediately and permanently. This can’t be undone.',
          )}
        </p>
        <div className="fd-profile-actions">
          <button type="button" className="fd-btn is-danger" onClick={() => void remove()} disabled={deleting}>
            {deleting ? <LoaderCircle size={16} className="fd-spin" /> : <UserX size={16} />}{' '}
            {t('Hesabı sil', 'Delete account')}
          </button>
        </div>
      </section>
    </>
  );
}

export function ProfilePage() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const admin = useAuth((s) => s.admin);

  useEffect(() => {
    document.title = t('Profil · flowdraft', 'Profile · flowdraft');
  }, []);

  useEffect(() => {
    if (ready && !user) openAuth('login', SIGN_IN_REASON);
  }, [ready, user]);

  let body;
  if (!ready) {
    body = (
      <p className="fd-muted fd-loading">
        <LoaderCircle size={16} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
      </p>
    );
  } else if (!user) {
    body = (
      <>
        <h1>{t('Profil', 'Profile')}</h1>
        <p className="fd-muted">{SIGN_IN_REASON}</p>
        <div className="fd-profile-actions">
          <button type="button" className="fd-btn is-primary" onClick={() => openAuth('login', SIGN_IN_REASON)}>
            {t('Giriş yap', 'Sign in')}
          </button>
        </div>
      </>
    );
  } else {
    body = <Account key={user.id} email={user.email ?? ''} createdAt={user.created_at} admin={!!admin} />;
  }

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-oauth-home" aria-label={t('flowdraft ana sayfa', 'flowdraft home')}>
          <Logo />
        </a>
        <div className="fd-legal-end">
          <LangSwitch />
          <a href="/" className="fd-btn is-ghost">
            <ArrowLeft size={16} /> {t('Uygulamayı aç', 'Open the app')}
          </a>
        </div>
      </header>
      <main className="fd-profile">{body}</main>
      <Credit />
      <AuthModal />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
