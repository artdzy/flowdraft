import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { lang, t } from '../i18n';
import { LEGAL_PATHS, LEGAL_VERSION } from '../legal/LegalPage';
import { siteOrigin } from '../lib/platform';
import { supabase } from '../lib/supabase';
import { closeAuth, completeAuth, useAuth } from '../store/auth';
import { Modal } from './Modal';

const ALREADY_REGISTERED = t(
  'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.',
  'This email is already registered. Try signing in.',
);

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return t('E-posta veya şifre hatalı.', 'Wrong email or password.');
  if (m.includes('email not confirmed'))
    return t('E-postanı henüz doğrulamadın. Gelen kutuna bak.', 'You haven’t confirmed your email yet. Check your inbox.');
  if (m.includes('already registered') || m.includes('already been registered')) return ALREADY_REGISTERED;
  if (m.includes('password should be at least'))
    return t('Şifre en az 6 karakter olmalı.', 'Your password must be at least 6 characters.');
  if (m.includes('rate limit') || m.includes('too many'))
    return t('Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.', 'Too many attempts. Wait a moment and try again.');
  if (m.includes('failed to fetch') || m.includes('network'))
    return t('Bağlantı kurulamadı. İnternetini kontrol et.', 'Couldn’t connect. Check your internet connection.');
  if (m.includes('invalid') && m.includes('email')) return t('Geçerli bir e-posta adresi yaz.', 'Enter a valid email address.');
  return message;
}

function AuthForm({ initialMode, reason }: { initialMode: 'login' | 'register'; reason: string }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError(
        t(
          'Giriş şu an kullanılamıyor: sunucu yapılandırması eksik.',
          'Sign-in isn’t available right now: the server isn’t set up.',
        ),
      );
      return;
    }
    if (mode === 'register' && !accepted) {
      setError(t('Kayıt olmak için şartları kabul etmelisin.', 'You need to accept the terms to sign up.'));
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        completeAuth(data.user);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: siteOrigin,
            // Proof of consent: which legal text version was accepted, and when.
            data: { legal_version: LEGAL_VERSION, legal_accepted_at: new Date().toISOString() },
          },
        });
        if (err) throw err;
        if (data.session && data.user) {
          completeAuth(data.user);
        } else if (data.user && data.user.identities?.length === 0) {
          setError(ALREADY_REGISTERED);
          setMode('login');
        } else {
          setInfo(
            t(
              'Neredeyse bitti! E-postana gelen bağlantıya tıkla, sonra buradan giriş yap. Çizimin bu cihazda saklı.',
              'Almost done! Click the link we emailed you, then sign in here. Your drawing is kept on this device.',
            ),
          );
          setMode('login');
        }
      }
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="fd-auth" onSubmit={submit} noValidate={false}>
      {reason && <p className="fd-auth-reason">{reason}</p>}
      <div className="fd-tabs" role="tablist" aria-label={t('Hesap', 'Account')}>
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
          {t('Giriş yap', 'Sign in')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
          {t('Kayıt ol', 'Sign up')}
        </button>
      </div>
      <label className="fd-field">
        <span className="fd-field-label">{t('E-posta', 'Email')}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="fd-field">
        <span className="fd-field-label">{t('Şifre', 'Password')}</span>
        <input
          type="password"
          name="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {mode === 'register' && (
        <>
          {lang === 'tr' ? (
            <p className="fd-auth-warning">
              flowdraft <strong>ücretsiz</strong> bir uygulamadır ve <strong>garanti verilmez</strong>. Veritabanı bir gün
              silinebilir, projelerin kaybolabilir. Önemli işlerini JSON olarak yedekle.
            </p>
          ) : (
            <p className="fd-auth-warning">
              flowdraft is a <strong>free</strong> app and comes with <strong>no warranty</strong>. The database could be
              wiped one day and your projects could be lost. Back up important work as JSON.
            </p>
          )}
          <label className="fd-consent">
            <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            {lang === 'tr' ? (
              <span>
                <a href={LEGAL_PATHS.terms} target="_blank" rel="noopener">
                  Kullanım Şartları
                </a>
                ’nı ve{' '}
                <a href={LEGAL_PATHS.privacy} target="_blank" rel="noopener">
                  Gizlilik Politikası
                </a>
                ’nı okudum, kabul ediyorum. Verilerimin silinebileceğini ve hiçbir garanti verilmediğini biliyorum.
              </span>
            ) : (
              <span>
                I’ve read and accept the{' '}
                <a href={LEGAL_PATHS.terms} target="_blank" rel="noopener">
                  Terms of Use
                </a>{' '}
                and{' '}
                <a href={LEGAL_PATHS.privacy} target="_blank" rel="noopener">
                  Privacy Policy
                </a>
                . I understand my data may be deleted and that no warranty is given.
              </span>
            )}
          </label>
        </>
      )}
      {error && (
        <p className="fd-form-error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="fd-form-info" role="status">
          {info}
        </p>
      )}
      <button type="submit" className="fd-btn is-primary is-block" disabled={busy || (mode === 'register' && !accepted)}>
        {busy && <LoaderCircle size={16} className="fd-spin" />}
        {mode === 'login' ? t('Giriş yap', 'Sign in') : t('Hesap oluştur', 'Create account')}
      </button>
      <p className="fd-auth-foot">
        {t(
          'Tuvaldeki çizimin kaybolmaz. Giriş yapınca kaldığın yerden devam edersin.',
          'You won’t lose what’s on your canvas. Once you sign in, you’ll pick up where you left off.',
        )}
      </p>
    </form>
  );
}

export function AuthModal() {
  const modal = useAuth((s) => s.modal);
  return (
    <Modal open={!!modal} onClose={closeAuth} title={t('Hesabın', 'Your account')} titleId="fd-auth-title" className="is-narrow">
      {modal && <AuthForm initialMode={modal.mode} reason={modal.reason} />}
    </Modal>
  );
}
