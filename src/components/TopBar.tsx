import {
  Bot,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  Eraser,
  FileJson,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Redo2,
  Save,
  Sun,
  Undo2,
  Upload,
  UserRound,
  UserX,
} from 'lucide-react';
import { useRef } from 'react';
import { importFile, requestAutosave, requestExport, requestSave, useSaveState } from '../lib/actions';
import { deleteAccount, openAuth, requireAuth, signOut, useAuth } from '../store/auth';
import { isDirty, useEditor } from '../store/editor';
import { useSettings } from '../store/settings';
import { toast, useUi } from '../store/ui';
import { THEME_LABEL, useTheme, type ThemePref } from '../store/theme';
import { Credit } from './Credit';
import { Segmented, Switch } from './fields';
import { Menu, MenuItem } from './Menu';

export function Logo() {
  return (
    <span className="fd-logo" aria-label="flowdraft">
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#1e1e1e" />
        <rect x="10" y="12" width="22" height="15" rx="4" fill="none" stroke="#f2f2f2" strokeWidth="3.5" />
        <rect x="32" y="37" width="22" height="15" rx="4" fill="#e5484d" />
        <path d="M21 27v17.5h7" fill="none" stroke="#f2f2f2" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="fd-logo-text">flowdraft</span>
    </span>
  );
}

function SaveStatus() {
  const user = useAuth((s) => s.user);
  const autosave = useSettings((s) => s.autosave);
  const status = useSaveState((s) => s.status);
  const dirty = useEditor(isDirty);
  const projectId = useEditor((s) => s.projectId);

  let text = 'Bu cihazda taslak';
  let icon = <CloudOff size={14} aria-hidden />;
  if (user) {
    if (status === 'saving') {
      text = 'Kaydediliyor…';
      icon = <LoaderCircle size={14} className="fd-spin" aria-hidden />;
    } else if (status === 'error') {
      text = 'Kaydedilemedi';
    } else if (dirty || !projectId) {
      text = autosave ? 'Birazdan kaydedilecek' : 'Kaydedilmedi';
    } else {
      text = 'Kaydedildi';
      icon = <Cloud size={14} aria-hidden />;
    }
  }
  return (
    <span className={`fd-status status-${status}`} role="status" aria-live="polite">
      {icon}
      <span>{text}</span>
    </span>
  );
}

const THEME_ORDER: ThemePref[] = ['system', 'light', 'dark'];
const THEME_ICON: Record<ThemePref, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

function ThemeButton() {
  const pref = useTheme((t) => t.pref);
  const setPref = useTheme((t) => t.setPref);
  const Icon = THEME_ICON[pref];
  const next = THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
  return (
    <button
      type="button"
      className="fd-icon-btn"
      aria-label={`Tema: ${THEME_LABEL[pref]}. ${THEME_LABEL[next]} temaya geç`}
      title={`Tema: ${THEME_LABEL[pref]}`}
      onClick={() => setPref(next)}
    >
      <Icon size={17} />
    </button>
  );
}

function ThemeChoice() {
  const pref = useTheme((t) => t.pref);
  const setPref = useTheme((t) => t.setPref);
  return (
    <div className="fd-menu-row">
      <Segmented<ThemePref>
        label="Tema"
        value={pref}
        onChange={setPref}
        options={THEME_ORDER.map((p) => {
          const Icon = THEME_ICON[p];
          return { value: p, label: <span className="fd-seg-icon"><Icon size={14} /> {THEME_LABEL[p]}</span> };
        })}
      />
    </div>
  );
}

function clearCanvas() {
  const { nodes, edges, clearCanvas: clear } = useEditor.getState();
  if (!nodes.length && !edges.length) return;
  clear();
  toast('Tuval temizlendi. Geri almak için ⌘Z / Ctrl+Z');
}

async function confirmDeleteAccount() {
  const ok = window.confirm(
    'Hesabın ve kayıtlı tüm projelerin kalıcı olarak silinsin mi? Bu işlem geri alınamaz. Tuvaldeki çizim bu cihazda kalır.',
  );
  if (!ok) return;
  try {
    await deleteAccount();
    toast('Hesabın silindi');
  } catch {
    toast('Hesap silinemedi. Biraz sonra tekrar dene.', 'error');
  }
}

function openProjects() {
  requireAuth('Projelerini görmek için giriş yap.', () => useUi.setState({ projectsOpen: true }));
}

export function TopBar({ mobile }: { mobile: boolean }) {
  const title = useEditor((s) => s.title);
  const setTitle = useEditor((s) => s.setTitle);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const user = useAuth((s) => s.user);
  const autosave = useSettings((s) => s.autosave);
  const saving = useSaveState((s) => s.status === 'saving');
  const fileInput = useRef<HTMLInputElement>(null);

  const titleInput = (
    <input
      className="fd-title"
      value={title}
      aria-label="Akış adı"
      maxLength={120}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={(e) => !e.target.value.trim() && setTitle('Adsız akış')}
    />
  );

  const hiddenImport = (
    <input
      ref={fileInput}
      type="file"
      accept="application/json,.json"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void importFile(file);
        e.target.value = '';
      }}
    />
  );

  const fileItems = (close: () => void) => (
    <>
      <MenuItem icon={<FilePlus2 size={16} />} onSelect={() => (close(), useUi.setState({ newOpen: true }))}>
        Yeni akış
      </MenuItem>
      <MenuItem icon={<FolderOpen size={16} />} onSelect={() => (close(), openProjects())}>
        Projelerim
      </MenuItem>
      <MenuItem icon={<Upload size={16} />} onSelect={() => (close(), fileInput.current?.click())}>
        JSON içe aktar
      </MenuItem>
      <MenuItem icon={<Bot size={16} />} onSelect={() => (close(), useUi.setState({ aiOpen: true }))}>
        AI araçlarına bağla
      </MenuItem>
      <MenuItem icon={<Eraser size={16} />} onSelect={() => (close(), clearCanvas())} danger>
        Tuvali temizle
      </MenuItem>
    </>
  );

  const exportItems = (close: () => void) => (
    <>
      <MenuItem icon={<Download size={16} />} onSelect={() => (close(), requestExport('png'))}>
        PNG görsel
      </MenuItem>
      <MenuItem icon={<Download size={16} />} onSelect={() => (close(), requestExport('svg'))}>
        SVG vektör
      </MenuItem>
      <MenuItem icon={<FileJson size={16} />} onSelect={() => (close(), requestExport('json'))}>
        JSON (düzenlenebilir)
      </MenuItem>
    </>
  );

  const accountItems = (close: () => void) =>
    user ? (
      <>
        <div className="fd-menu-caption">{user.email}</div>
        <MenuItem icon={<LogOut size={16} />} onSelect={() => (close(), void signOut())}>
          Çıkış yap
        </MenuItem>
        <MenuItem icon={<UserX size={16} />} onSelect={() => (close(), void confirmDeleteAccount())} danger>
          Hesabı sil
        </MenuItem>
      </>
    ) : (
      <>
        <MenuItem icon={<LogIn size={16} />} onSelect={() => (close(), openAuth('login'))}>
          Giriş yap
        </MenuItem>
        <MenuItem icon={<UserRound size={16} />} onSelect={() => (close(), openAuth('register'))}>
          Kayıt ol
        </MenuItem>
      </>
    );

  if (mobile) {
    return (
      <header className="fd-topbar is-mobile">
        <Logo />
        {titleInput}
        <button type="button" className="fd-icon-btn" aria-label="Kaydet" onClick={requestSave} disabled={saving}>
          {saving ? <LoaderCircle size={18} className="fd-spin" /> : <Save size={18} />}
        </button>
        <Menu label={<MenuIcon size={18} />} ariaLabel="Menü" buttonClassName="fd-icon-btn" align="right">
          {(close) => (
            <>
              <div className="fd-menu-row">
                <Switch label="Otomatik kaydet" checked={autosave && !!user} onChange={(on) => (close(), requestAutosave(on))} />
              </div>
              <ThemeChoice />
              <div className="fd-menu-sep" />
              {fileItems(close)}
              <div className="fd-menu-sep" />
              <div className="fd-menu-caption">Dışa aktar</div>
              {exportItems(close)}
              <div className="fd-menu-sep" />
              {accountItems(close)}
              <div className="fd-menu-credit">
                <Credit />
              </div>
            </>
          )}
        </Menu>
        {hiddenImport}
      </header>
    );
  }

  return (
    <header className="fd-topbar">
      <Logo />
      <Menu label={<>Dosya <ChevronDown size={14} /></>} buttonClassName="fd-btn is-ghost">
        {fileItems}
      </Menu>
      {titleInput}
      <div className="fd-topbar-spacer" />
      <div className="fd-topbar-group">
        <button type="button" className="fd-icon-btn" aria-label="Geri al" title="Geri al (⌘Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 size={17} />
        </button>
        <button type="button" className="fd-icon-btn" aria-label="İleri al" title="İleri al (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 size={17} />
        </button>
      </div>
      <SaveStatus />
      <Switch label="Otomatik kaydet" checked={autosave && !!user} onChange={requestAutosave} />
      <button type="button" className="fd-btn is-primary" onClick={requestSave} disabled={saving} title="Kaydet (⌘S)">
        {saving ? <LoaderCircle size={16} className="fd-spin" /> : <Save size={16} />} Kaydet
      </button>
      <Menu label={<><Download size={16} /> Dışa aktar</>} align="right">
        {exportItems}
      </Menu>
      <ThemeButton />
      {user ? (
        <Menu
          label={<span className="fd-avatar">{(user.email ?? '?').slice(0, 1).toLocaleUpperCase('tr')}</span>}
          ariaLabel="Hesap"
          buttonClassName="fd-icon-btn"
          align="right"
        >
          {accountItems}
        </Menu>
      ) : (
        <button type="button" className="fd-btn" onClick={() => openAuth('login')}>
          <LogIn size={16} /> Giriş yap
        </button>
      )}
      {hiddenImport}
    </header>
  );
}
