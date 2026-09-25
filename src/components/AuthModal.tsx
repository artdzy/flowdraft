import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LEGAL_PATHS, LEGAL_VERSION } from '../legal/LegalPage';
import { siteOrigin } from '../lib/platform';
import { supabase } from '../lib/supabase';
import { closeAuth, completeAuth, useAuth } from '../store/auth';
import { Modal } from './Modal';

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (m.includes('email not confirmed')) return 'E-postanı henüz doğrulamadın. Gelen kutuna bak.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  if (m.includes('password should be at least')) return 'Şifre en az 6 karakter olmalı.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Bağlantı kurulamadı. İnternetini kontrol et.';
  if (m.includes('invalid') && m.includes('email')) return 'Geçerli bir e-posta adresi yaz.';
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
      setError('Giriş şu an kullanılamıyor: sunucu yapılandırması eksik.');
      return;
    }
    if (mode === 'register' && !accepted) {
      setError('Kayıt olmak için şartları kabul etmelisin.');
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
          setError('Bu e-posta zaten kayıtlı. Giriş yapmayı dene.');
          setMode('login');
        } else {
          setInfo('Neredeyse bitti! E-postana gelen bağlantıya tıkla, sonra buradan giriş yap. Çizimin bu cihazda saklı.');
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
      <div className="fd-tabs" role="tablist" aria-label="Hesap">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
          Giriş yap
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
          Kayıt ol
        </button>
      </div>
      <label className="fd-field">
        <span className="fd-field-label">E-posta</span>
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
        <span className="fd-field-label">Şifre</span>
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
          <p className="fd-auth-warning">
            flowdraft <strong>ücretsiz</strong> bir uygulamadır ve <strong>garanti verilmez</strong>. Veritabanı bir gün
            silinebilir, projelerin kaybolabilir. Önemli işlerini JSON olarak yedekle.
          </p>
          <label className="fd-consent">
            <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
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
        {mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
      </button>
      <p className="fd-auth-foot">Tuvaldeki çizimin kaybolmaz. Giriş yapınca kaldığın yerden devam edersin.</p>
    </form>
  );
}

export function AuthModal() {
  const modal = useAuth((s) => s.modal);
  return (
    <Modal open={!!modal} onClose={closeAuth} title="Hesabın" titleId="fd-auth-title" className="is-narrow">
      {modal && <AuthForm initialMode={modal.mode} reason={modal.reason} />}
    </Modal>
  );
}
