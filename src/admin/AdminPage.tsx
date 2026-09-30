import { ArrowLeft, ChevronDown, ChevronRight, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AuthModal } from '../components/AuthModal';
import { Credit } from '../components/Credit';
import { LangSwitch } from '../components/LangSwitch';
import { Logo } from '../components/TopBar';
import { locale, t } from '../i18n';
import { ADMIN_PATH, listMemberFlows, listMembers, type Member, type MemberFlow } from '../lib/admin';
import { describeError } from '../lib/projects';
import { openAuth, signOut, useAuth } from '../store/auth';

export function isAdminPath(pathname: string) {
  return pathname.replace(/\/+$/, '') === ADMIN_PATH;
}

const SIGN_IN_REASON = t('Yönetim paneli için giriş yap.', 'Sign in to open the admin panel.');
const WEEK = 7 * 24 * 60 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const numFmt = new Intl.NumberFormat(locale);

const fmt = (f: Intl.DateTimeFormat, iso: string | null) => (iso ? f.format(new Date(iso)) : '—');
const within = (iso: string | null, ms: number) => !!iso && Date.now() - new Date(iso).getTime() < ms;

type Flows = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: MemberFlow[] };

function FlowList({ flows }: { flows: Flows | undefined }) {
  if (!flows || flows.status === 'loading')
    return (
      <p className="fd-muted fd-loading">
        <LoaderCircle size={14} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
      </p>
    );
  if (flows.status === 'error') return <p className="fd-form-error">{flows.message}</p>;
  if (!flows.rows.length) return <p className="fd-muted">{t('Kayıtlı akışı yok.', 'No saved flows.')}</p>;
  return (
    <ul className="fd-admin-flows">
      {flows.rows.map((f) => (
        <li key={f.id}>
          <span className="fd-admin-flow-title">{f.title}</span>
          <span className="fd-admin-mono">
            {t(`${numFmt.format(f.node_count)} parça`, `${numFmt.format(f.node_count)} nodes`)}
          </span>
          <span className="fd-admin-mono">{fmt(timeFmt, f.updated_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function Members({ members }: { members: Member[] }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [flows, setFlows] = useState<Record<string, Flows>>({});

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    return q ? members.filter((m) => (m.email ?? '').toLocaleLowerCase(locale).includes(q)) : members;
  }, [members, query]);

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (flows[id]?.status === 'ready') return;
    setFlows((all) => ({ ...all, [id]: { status: 'loading' } }));
    listMemberFlows(id).then(
      (rows) => setFlows((all) => ({ ...all, [id]: { status: 'ready', rows } })),
      (err) => setFlows((all) => ({ ...all, [id]: { status: 'error', message: describeError(err) } })),
    );
  };

  return (
    <>
      <label className="fd-admin-search">
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('E-posta ara', 'Search by email')}
          aria-label={t('E-posta ara', 'Search by email')}
        />
      </label>
      <div className="fd-admin-table-wrap">
        <table className="fd-admin-table">
          <thead>
            <tr>
              <th scope="col">{t('Üye', 'Member')}</th>
              <th scope="col" className="is-num">
                {t('Akış', 'Flows')}
              </th>
              <th scope="col">{t('Kayıt', 'Joined')}</th>
              <th scope="col">{t('Son giriş', 'Last sign-in')}</th>
              <th scope="col">{t('Son akış', 'Last flow')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const open = openId === m.id;
              return [
                <tr key={m.id} className={open ? 'is-open' : undefined}>
                  <th scope="row">
                    <button
                      type="button"
                      className="fd-admin-member"
                      aria-expanded={open}
                      aria-controls={`fd-admin-flows-${m.id}`}
                      onClick={() => toggle(m.id)}
                    >
                      {open ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
                      <span>{m.email ?? t('(e-posta yok)', '(no email)')}</span>
                    </button>
                  </th>
                  <td className="is-num">{numFmt.format(m.flow_count)}</td>
                  <td>{fmt(dateFmt, m.created_at)}</td>
                  <td>{fmt(timeFmt, m.last_sign_in_at)}</td>
                  <td>{fmt(timeFmt, m.last_flow_at)}</td>
                </tr>,
                open && (
                  <tr key={`${m.id}-flows`} className="fd-admin-detail" id={`fd-admin-flows-${m.id}`}>
                    <td colSpan={5}>
                      <FlowList flows={flows[m.id]} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
        {!shown.length && <p className="fd-muted fd-admin-empty">{t('Eşleşen üye yok.', 'No matching members.')}</p>}
      </div>
    </>
  );
}

function Panel() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    listMembers().then(
      (rows) => (setMembers(rows), setLoading(false)),
      (err) => (setError(describeError(err)), setLoading(false)),
    );
  };
  useEffect(load, []);

  const stats = useMemo(() => {
    const rows = members ?? [];
    return [
      { label: t('Üye', 'Members'), value: rows.length },
      { label: t('Akış', 'Flows'), value: rows.reduce((sum, m) => sum + m.flow_count, 0) },
      { label: t('Son 7 günde kayıt', 'Joined in 7 days'), value: rows.filter((m) => within(m.created_at, WEEK)).length },
      {
        label: t('Son 7 günde giriş', 'Signed in in 7 days'),
        value: rows.filter((m) => within(m.last_sign_in_at, WEEK)).length,
      },
    ];
  }, [members]);

  return (
    <>
      <div className="fd-admin-title">
        <h1>{t('Yönetim paneli', 'Admin panel')}</h1>
        <button type="button" className="fd-btn" onClick={load} disabled={loading}>
          {loading ? <LoaderCircle size={16} className="fd-spin" /> : <RefreshCw size={16} />} {t('Yenile', 'Refresh')}
        </button>
      </div>
      {error && (
        <p className="fd-form-error" role="alert">
          {error}
        </p>
      )}
      {members && (
        <>
          <dl className="fd-admin-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{numFmt.format(s.value)}</dd>
              </div>
            ))}
          </dl>
          <Members members={members} />
          <p className="fd-muted fd-small">
            {t(
              'Bir üyeye tıklayınca akışlarının başlıkları listelenir. Akış içeriği bu panelde gösterilmez.',
              'Click a member to list the titles of their flows. Flow contents aren’t shown in this panel.',
            )}
          </p>
        </>
      )}
    </>
  );
}

export function AdminPage() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const admin = useAuth((s) => s.admin);

  useEffect(() => {
    document.title = t('Yönetim paneli · flowdraft', 'Admin panel · flowdraft');
  }, []);

  useEffect(() => {
    if (ready && !user) openAuth('login', SIGN_IN_REASON);
  }, [ready, user]);

  let body;
  if (!ready || (user && admin === null)) {
    body = (
      <p className="fd-muted fd-loading">
        <LoaderCircle size={16} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
      </p>
    );
  } else if (!user) {
    body = (
      <div className="fd-admin-gate">
        <h1>{t('Yönetim paneli', 'Admin panel')}</h1>
        <p className="fd-muted">{SIGN_IN_REASON}</p>
        <button type="button" className="fd-btn is-primary" onClick={() => openAuth('login', SIGN_IN_REASON)}>
          {t('Giriş yap', 'Sign in')}
        </button>
      </div>
    );
  } else if (!admin) {
    body = (
      <div className="fd-admin-gate">
        <h1>{t('Bu sayfaya erişimin yok', 'You don’t have access to this page')}</h1>
        <p className="fd-muted">
          {t(
            `${user.email} hesabı yönetici değil.`,
            `The account ${user.email} isn’t an admin.`,
          )}
        </p>
        <button type="button" className="fd-btn" onClick={() => void signOut()}>
          {t('Başka bir hesapla giriş yap', 'Sign in with a different account')}
        </button>
      </div>
    );
  } else {
    body = <Panel />;
  }

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-oauth-home" aria-label={t('flowdraft ana sayfa', 'flowdraft home')}>
          <Logo />
        </a>
        <div className="fd-legal-end">
          {user && <span className="fd-admin-mono">{user.email}</span>}
          <LangSwitch />
          <a href="/" className="fd-btn is-ghost">
            <ArrowLeft size={16} /> {t('Uygulamayı aç', 'Open the app')}
          </a>
        </div>
      </header>
      <main className="fd-admin">{body}</main>
      <Credit />
      <AuthModal />
    </div>
  );
}
