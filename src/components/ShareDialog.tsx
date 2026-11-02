import { Globe, LoaderCircle, Lock, Mail, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '../i18n';
import {
  describeShareError,
  getShare,
  saveShare,
  shareUrl,
  stopShare,
  type ShareMember,
  type ShareRole,
  type ShareSettings,
  type ShareVisibility,
} from '../lib/share';
import { useEditor } from '../store/editor';
import { askConfirm, toast, useUi } from '../store/ui';
import { CopyField } from './Copy';
import { Segmented } from './fields';
import { Modal } from './Modal';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ROLE_LABEL: Record<ShareRole, string> = {
  viewer: t('Salt okunur', 'Read only'),
  editor: t('Düzenleyebilir', 'Can edit'),
};

function RoleSelect({ value, onChange, label }: { value: ShareRole; onChange: (role: ShareRole) => void; label: string }) {
  return (
    <select className="fd-share-role" value={value} aria-label={label} onChange={(e) => onChange(e.target.value as ShareRole)}>
      <option value="viewer">{ROLE_LABEL.viewer}</option>
      <option value="editor">{ROLE_LABEL.editor}</option>
    </select>
  );
}

function ShareForm({ flow, title }: { flow: string; title: string }) {
  const [share, setShare] = useState<ShareSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [visibility, setVisibility] = useState<ShareVisibility>('public');
  const [password, setPassword] = useState('');
  const [members, setMembers] = useState<ShareMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Reading the settings failed, e.g. the open flow belongs to someone else: there's no form to show. */
  const [blocked, setBlocked] = useState('');

  const show = (settings: ShareSettings | null) => {
    setShare(settings);
    setVisibility(settings?.visibility ?? 'public');
    setMembers(settings?.members ?? []);
    setPassword('');
  };

  useEffect(() => {
    let alive = true;
    getShare(flow).then(
      (settings) => {
        if (!alive) return;
        show(settings);
        setLoaded(true);
      },
      (err) => {
        if (!alive) return;
        setBlocked(describeShareError(err));
        setLoaded(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [flow]);

  /** The list with what is typed in the email box, or null (with the error shown) when that isn't an address. */
  const withTyped = (): ShareMember[] | null => {
    const typed = email.trim().toLowerCase();
    if (!typed) return members;
    if (!EMAIL.test(typed)) {
      setError(t('Geçerli bir e-posta adresi yaz.', 'Enter a valid email address.'));
      return null;
    }
    setError('');
    return [...members.filter((m) => m.email !== typed), { email: typed, role }];
  };

  const add = () => {
    const next = withTyped();
    if (!next) return;
    setMembers(next);
    setEmail('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = withTyped();
    if (!next) return;
    setBusy(true);
    setError('');
    try {
      show(await saveShare(flow, visibility, visibility === 'private' && password ? password : null, next));
      setEmail('');
      toast(share ? t('Paylaşım güncellendi', 'Sharing updated') : t('Link hazır', 'Your link is ready'));
    } catch (err) {
      setError(describeShareError(err));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    const ok = await askConfirm({
      title: t('Paylaşımı kapat', 'Stop sharing'),
      message: t(
        'Link çalışmayı bırakacak ve eklediğin kişiler bu akışa erişemeyecek. Akışın silinmez.',
        'The link will stop working and the people you added will lose access. Your flow isn’t deleted.',
      ),
      confirmLabel: t('Paylaşımı kapat', 'Stop sharing'),
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await stopShare(flow);
      show(null);
      toast(t('Paylaşım kapatıldı', 'Sharing stopped'));
    } catch (err) {
      setError(describeShareError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded)
    return (
      <p className="fd-muted fd-loading">
        <LoaderCircle size={16} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
      </p>
    );
  if (blocked) return <p className="fd-form-error">{blocked}</p>;

  const url = share ? shareUrl(share.token) : '';
  const mailto =
    `mailto:${share?.members.map((m) => m.email).join(',') ?? ''}` +
    `?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;

  return (
    <form className="fd-share" onSubmit={(e) => void submit(e)}>
      <Segmented<ShareVisibility>
        label={t('Link erişimi', 'Link access')}
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: 'public', label: <span className="fd-seg-icon"><Globe size={14} /> {t('Herkese açık', 'Public')}</span> },
          { value: 'private', label: <span className="fd-seg-icon"><Lock size={14} /> {t('Gizli', 'Private')}</span> },
        ]}
      />
      <p className="fd-muted fd-small">
        {visibility === 'public'
          ? t('Linki bilen herkes akışı salt okunur görür.', 'Anyone with the link can view the flow, read only.')
          : t(
              'Link şifreyle açılır ve salt okunur görünür. Eklediğin kişiler şifresiz, kendi hesaplarıyla girer.',
              'The link opens with a password, read only. People you add get in with their own account, no password needed.',
            )}
      </p>

      {visibility === 'private' && (
        <label className="fd-field">
          <span className="fd-field-label">{t('Şifre', 'Password')}</span>
          <input
            type="password"
            name="share-password"
            autoComplete="new-password"
            maxLength={72}
            value={password}
            placeholder={share?.has_password ? t('Değiştirmek için yaz', 'Type to change it') : t('En az 4 karakter', 'At least 4 characters')}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}

      <div className="fd-field">
        <span className="fd-field-label">{t('Kişi ekle', 'Add people')}</span>
        <div className="fd-share-add">
          <input
            type="email"
            name="share-email"
            autoComplete="off"
            inputMode="email"
            placeholder={t('ornek@eposta.com', 'name@example.com')}
            aria-label={t('E-posta', 'Email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !email.trim()) return;
              e.preventDefault();
              add();
            }}
          />
          <RoleSelect value={role} onChange={setRole} label={t('Yetki', 'Access')} />
          <button type="button" className="fd-icon-btn" aria-label={t('Kişiyi ekle', 'Add this person')} onClick={add}>
            <UserPlus size={17} />
          </button>
        </div>
        <p className="fd-muted fd-small">
          {t(
            'E-posta yazmazsan akış sadece salt okunur paylaşılır. Düzenleme yalnızca eklediğin kişilere açılır; bu kişiler aynı e-postayla giriş yapmalı.',
            'Without an email, the flow is shared read only. Only people you add can edit, and they must sign in with that email.',
          )}
        </p>
      </div>

      {members.length > 0 && (
        <ul className="fd-share-members">
          {members.map((m) => (
            <li key={m.email}>
              <span className="fd-share-email">{m.email}</span>
              <RoleSelect
                value={m.role}
                label={t(`${m.email} yetkisi`, `Access for ${m.email}`)}
                onChange={(next) => setMembers((list) => list.map((x) => (x.email === m.email ? { ...x, role: next } : x)))}
              />
              <button
                type="button"
                className="fd-icon-btn"
                aria-label={t(`${m.email} kişisini kaldır`, `Remove ${m.email}`)}
                onClick={() => setMembers((list) => list.filter((x) => x.email !== m.email))}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="fd-form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="fd-btn is-primary is-block" disabled={busy}>
        {busy && <LoaderCircle size={16} className="fd-spin" />}
        {share ? t('Değişiklikleri kaydet', 'Save changes') : t('Paylaşım linki oluştur', 'Create share link')}
      </button>

      {share && (
        <div className="fd-share-link">
          <span className="fd-field-label" id="fd-share-url">
            {t('Paylaşım linki', 'Share link')}
          </span>
          <CopyField value={url} labelId="fd-share-url" />
          <p className="fd-muted fd-small">
    {t('Link akışın son kaydedilen halini gösterir.', 'The link shows the last saved version of your flow.')}
          </p>
          <div className="fd-share-actions">
            {share.members.length > 0 && (
              <a className="fd-btn" href={mailto}>
                <Mail size={15} /> {t('Kişilere e-posta gönder', 'Email these people')}
              </a>
            )}
            <button type="button" className="fd-btn is-danger" onClick={() => void stop()} disabled={busy}>
              {t('Paylaşımı kapat', 'Stop sharing')}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function ShareDialog() {
  const open = useUi((s) => s.shareOpen);
  const flow = useEditor((s) => s.projectId);
  const title = useEditor((s) => s.title);
  return (
    <Modal open={open} onClose={() => useUi.setState({ shareOpen: false })} title={t('Akışı paylaş', 'Share flow')} titleId="fd-share-title">
      {flow && <ShareForm key={flow} flow={flow} title={title} />}
    </Modal>
  );
}
