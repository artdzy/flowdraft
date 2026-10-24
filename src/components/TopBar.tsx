import {
  BookOpen,
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
  ShieldCheck,
  Sun,
  Undo2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useRef, type MouseEvent, type PointerEvent } from 'react';
import { lang, locale, setLang, t, UNTITLED, type Lang } from '../i18n';
import { ADMIN_PATH, PROFILE_PATH } from '../lib/admin';
import { importFile, requestAutosave, requestExport, requestSave, useSaveState } from '../lib/actions';
import { guideHref } from '../lib/guides';
import { macApp, postNative } from '../lib/platform';
import { openAuth, requireAuth, signOut, useAuth } from '../store/auth';
import { isDirty, useEditor } from '../store/editor';
import { useSettings } from '../store/settings';
import { toast, useUi } from '../store/ui';
import { THEME_LABEL, useTheme, type ThemePref } from '../store/theme';
import { Credit } from './Credit';
import { Segmented, Switch } from './fields';
import { LANGS, LangSwitch } from './LangSwitch';
import { Menu, MenuItem, MenuLink } from './Menu';

export function Logo() {
  return (
    <span className="fd-logo" aria-label="flowdraft">
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#1a1a1a" />
        <path
          fill="#f2f2f2"
          d="M47 9H28C19.163 9 12 16.163 12 25V51C12 54.314 14.686 57 18 57S24 54.314 24 51V38H41V28H24V25C24 22.791 25.791 21 28 21H47C50.314 21 53 18.314 53 15S50.314 9 47 9Z"
        />
        <rect x="37" y="25" width="16" height="16" rx="4" fill="#e5484d" />
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

  let text = t('Bu cihazda taslak', 'Draft on this device');
  let icon = <CloudOff size={14} aria-hidden />;
  if (user) {
    if (status === 'saving') {
      text = t('Kaydediliyor…', 'Saving…');
      icon = <LoaderCircle size={14} className="fd-spin" aria-hidden />;
    } else if (status === 'error') {
      text = t('Kaydedilemedi', 'Couldn’t save');
    } else if (dirty || !projectId) {
      text = autosave ? t('Birazdan kaydedilecek', 'Saving soon') : t('Kaydedilmedi', 'Not saved');
    } else {
      text = t('Kaydedildi', 'Saved');
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
  const pref = useTheme((s) => s.pref);
  const setPref = useTheme((s) => s.setPref);
  const Icon = THEME_ICON[pref];
  const next = THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
  return (
    <button
      type="button"
      className="fd-icon-btn"
      aria-label={t(
        `Tema: ${THEME_LABEL[pref]}. ${THEME_LABEL[next]} temaya geç`,
        `Theme: ${THEME_LABEL[pref]}. Switch to ${THEME_LABEL[next].toLowerCase()} theme`,
      )}
      title={t(`Tema: ${THEME_LABEL[pref]}`, `Theme: ${THEME_LABEL[pref]}`)}
      onClick={() => setPref(next)}
    >
      <Icon size={17} />
    </button>
  );
}

function ThemeChoice() {
  const pref = useTheme((s) => s.pref);
  const setPref = useTheme((s) => s.setPref);
  return (
    <div className="fd-menu-row">
      <Segmented<ThemePref>
        label={t('Tema', 'Theme')}
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

function LangChoice() {
  return (
    <div className="fd-menu-row">
      <Segmented<Lang>
        label={t('Dil', 'Language')}
        value={lang}
        onChange={setLang}
        options={LANGS.map((l) => ({ value: l.value, label: <span lang={l.value}>{l.name}</span> }))}
      />
    </div>
  );
}

/** In the Mac app the top bar is also the window's grip: empty parts of it move the window, like a title bar would. */
const INTERACTIVE = 'button, input, a, select, textarea, label, [role="menu"], .fd-menu';

function onBarPointerDown(event: PointerEvent<HTMLElement>) {
  if (!macApp || event.button !== 0 || (event.target as HTMLElement).closest(INTERACTIVE)) return;
  postNative({ type: 'dragWindow' });
}

function onBarDoubleClick(event: MouseEvent<HTMLElement>) {
  if (!macApp || (event.target as HTMLElement).closest(INTERACTIVE)) return;
  postNative({ type: 'zoomWindow' });
}

function clearCanvas() {
  const { nodes, edges, clearCanvas: clear } = useEditor.getState();
  if (!nodes.length && !edges.length) return;
  clear();
  toast(t('Tuval temizlendi. Geri almak için ⌘Z / Ctrl+Z', 'Canvas cleared. Press ⌘Z / Ctrl+Z to undo'));
}

function openProjects() {
  requireAuth(t('Projelerini görmek için giriş yap.', 'Sign in to see your projects.'), () =>
    useUi.setState({ projectsOpen: true }),
  );
}

export function TopBar({ mobile }: { mobile: boolean }) {
  const title = useEditor((s) => s.title);
  const setTitle = useEditor((s) => s.setTitle);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const user = useAuth((s) => s.user);
  const admin = useAuth((s) => s.admin);
  const autosave = useSettings((s) => s.autosave);
  const saving = useSaveState((s) => s.status === 'saving');
  const fileInput = useRef<HTMLInputElement>(null);

  const titleInput = (
    <input
      className="fd-title"
      value={title}
      aria-label={t('Akış adı', 'Flow name')}
      maxLength={120}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={(e) => !e.target.value.trim() && setTitle(UNTITLED)}
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
        {t('Yeni akış', 'New flow')}
      </MenuItem>
      <MenuItem icon={<FolderOpen size={16} />} onSelect={() => (close(), openProjects())}>
        {t('Projelerim', 'My projects')}
      </MenuItem>
      <MenuItem icon={<Upload size={16} />} onSelect={() => (close(), fileInput.current?.click())}>
        {t('JSON içe aktar', 'Import JSON')}
      </MenuItem>
      <MenuItem icon={<Bot size={16} />} onSelect={() => (close(), useUi.setState({ aiOpen: true }))}>
        {t('AI araçlarına bağla', 'Connect AI tools')}
      </MenuItem>
      <MenuLink icon={<BookOpen size={16} />} href={guideHref('what')} onSelect={close}>
        {t('Akış diyagramı rehberi', 'Flowchart guide')}
      </MenuLink>
      <MenuItem icon={<Eraser size={16} />} onSelect={() => (close(), clearCanvas())} danger>
        {t('Tuvali temizle', 'Clear canvas')}
      </MenuItem>
    </>
  );

  const exportItems = (close: () => void) => (
    <>
      <MenuItem icon={<Download size={16} />} onSelect={() => (close(), requestExport('png'))}>
        {t('PNG görsel', 'PNG image')}
      </MenuItem>
      <MenuItem icon={<Download size={16} />} onSelect={() => (close(), requestExport('svg'))}>
        {t('SVG vektör', 'SVG vector')}
      </MenuItem>
      <MenuItem icon={<FileJson size={16} />} onSelect={() => (close(), requestExport('json'))}>
        {t('JSON (düzenlenebilir)', 'JSON (editable)')}
      </MenuItem>
    </>
  );

  const accountItems = (close: () => void) =>
    user ? (
      <>
        <div className="fd-menu-caption">{user.email}</div>
        <MenuItem icon={<UserRound size={16} />} onSelect={() => (close(), window.location.assign(PROFILE_PATH))}>
          {t('Profil', 'Profile')}
        </MenuItem>
        {admin && (
          <MenuItem icon={<ShieldCheck size={16} />} onSelect={() => (close(), window.location.assign(ADMIN_PATH))}>
            {t('Yönetim paneli', 'Admin panel')}
          </MenuItem>
        )}
        <MenuItem icon={<LogOut size={16} />} onSelect={() => (close(), void signOut())}>
          {t('Çıkış yap', 'Sign out')}
        </MenuItem>
      </>
    ) : (
      <>
        <MenuItem icon={<LogIn size={16} />} onSelect={() => (close(), openAuth('login'))}>
          {t('Giriş yap', 'Sign in')}
        </MenuItem>
        <MenuItem icon={<UserRound size={16} />} onSelect={() => (close(), openAuth('register'))}>
          {t('Kayıt ol', 'Sign up')}
        </MenuItem>
      </>
    );

  if (mobile) {
    return (
      <header className="fd-topbar is-mobile">
        <Logo />
        {titleInput}
        {/* Always on screen (unlike the menu), so the phone layout links to the guides too. */}
        <a className="fd-icon-btn" href={guideHref('what')} title={t('Akış diyagramı rehberi', 'Flowchart guide')}>
          <BookOpen size={18} aria-hidden />
          <span className="fd-sr-only">{t('Akış diyagramı rehberi', 'Flowchart guide')}</span>
        </a>
        <button type="button" className="fd-icon-btn" aria-label={t('Kaydet', 'Save')} onClick={requestSave} disabled={saving}>
          {saving ? <LoaderCircle size={18} className="fd-spin" /> : <Save size={18} />}
        </button>
        <Menu label={<MenuIcon size={18} />} ariaLabel={t('Menü', 'Menu')} buttonClassName="fd-icon-btn" align="right">
          {(close) => (
            <>
              <div className="fd-menu-row">
                <Switch
                  label={t('Otomatik kaydet', 'Auto-save')}
                  checked={autosave && !!user}
                  onChange={(on) => (close(), requestAutosave(on))}
                />
              </div>
              <ThemeChoice />
              <LangChoice />
              <div className="fd-menu-sep" />
              {fileItems(close)}
              <div className="fd-menu-sep" />
              <div className="fd-menu-caption">{t('Dışa aktar', 'Export')}</div>
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
    <header className="fd-topbar" onPointerDown={onBarPointerDown} onDoubleClick={onBarDoubleClick}>
      <Logo />
      <Menu label={<>{t('Dosya', 'File')} <ChevronDown size={14} /></>} buttonClassName="fd-btn is-ghost">
        {fileItems}
      </Menu>
      {titleInput}
      <div className="fd-topbar-spacer" />
      <div className="fd-topbar-group">
        <button
          type="button"
          className="fd-icon-btn"
          aria-label={t('Geri al', 'Undo')}
          title={t('Geri al (⌘Z)', 'Undo (⌘Z)')}
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          className="fd-icon-btn"
          aria-label={t('İleri al', 'Redo')}
          title={t('İleri al (⇧⌘Z)', 'Redo (⇧⌘Z)')}
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 size={17} />
        </button>
      </div>
      <SaveStatus />
      <Switch label={t('Otomatik kaydet', 'Auto-save')} checked={autosave && !!user} onChange={requestAutosave} />
      <button
        type="button"
        className="fd-btn is-primary"
        onClick={requestSave}
        disabled={saving}
        title={t('Kaydet (⌘S)', 'Save (⌘S)')}
      >
        {saving ? <LoaderCircle size={16} className="fd-spin" /> : <Save size={16} />} {t('Kaydet', 'Save')}
      </button>
      <Menu label={<><Download size={16} /> {t('Dışa aktar', 'Export')}</>} align="right">
        {exportItems}
      </Menu>
      <LangSwitch />
      <ThemeButton />
      {user ? (
        <Menu
          label={<span className="fd-avatar">{(user.email ?? '?').slice(0, 1).toLocaleUpperCase(locale)}</span>}
          ariaLabel={t('Hesap', 'Account')}
          buttonClassName="fd-icon-btn"
          align="right"
        >
          {accountItems}
        </Menu>
      ) : (
        <button type="button" className="fd-btn" onClick={() => openAuth('login')}>
          <LogIn size={16} /> {t('Giriş yap', 'Sign in')}
        </button>
      )}
      {hiddenImport}
    </header>
  );
}
