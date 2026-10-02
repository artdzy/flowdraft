import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { t, UNTITLED } from '../i18n';
import { checkAdmin } from '../lib/admin';
import { clearDraft } from '../lib/draft';
import { supabase } from '../lib/supabase';
import { useEditor } from './editor';
import { useSettings } from './settings';

type AuthMode = 'login' | 'register';

type AuthState = {
  user: User | null;
  /** The signed-in account may open the admin panel (/yonetim). Null while that is being checked. */
  admin: boolean | null;
  ready: boolean;
  modal: { mode: AuthMode; reason: string } | null;
  /** Action the user was trying to do before being asked to sign in. */
  pending: (() => void) | null;
};

export const useAuth = create<AuthState>()(() => ({
  user: null,
  admin: false,
  ready: !supabase,
  modal: null,
  pending: null,
}));

export function initAuth() {
  if (!supabase) return;
  useAuth.subscribe((state, prev) => {
    const id = state.user?.id;
    if (id === prev.user?.id) return;
    // Signed out here, in another tab or by an expired session: the next person must not see this account's flow.
    if (prev.user && !id) resetWorkspace();
    useAuth.setState({ admin: id ? null : false });
    if (!id) return;
    void checkAdmin()
      .catch(() => false)
      .then((admin) => {
        if (useAuth.getState().user?.id === id) useAuth.setState({ admin });
      });
  });
  void supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({ user: data.session?.user ?? null, ready: true });
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ user: session?.user ?? null, ready: true });
  });
}

/** Runs `action` now if signed in; otherwise opens the sign-in modal and runs it after sign-in. */
export function requireAuth(reason: string, action: () => void) {
  if (useAuth.getState().user) {
    action();
    return;
  }
  useAuth.setState({ modal: { mode: 'login', reason }, pending: action });
}

export function openAuth(mode: AuthMode, reason = '') {
  useAuth.setState({ modal: { mode, reason }, pending: null });
}

export function closeAuth() {
  if (!useAuth.getState().modal) return;
  useAuth.setState({ modal: null, pending: null });
}

export function completeAuth(user: User) {
  const { pending } = useAuth.getState();
  useAuth.setState({ user, modal: null, pending: null });
  if (pending) setTimeout(pending, 0);
}

/** Empties the canvas and the copy mirrored to this device, so an account's flow never outlives its session. */
function resetWorkspace() {
  useSettings.getState().setAutosave(false);
  useEditor.getState().loadDoc({ version: 1, nodes: [], edges: [] }, { title: UNTITLED, projectId: null, dirty: false });
  clearDraft();
}

export async function signOut() {
  await supabase?.auth.signOut();
  resetWorkspace();
}

/** Permanently deletes the signed-in account and its saved projects (see supabase/migrations/0002_delete_account.sql). */
export async function deleteAccount() {
  if (!supabase) throw new Error(t('Sunucu bağlantısı yapılandırılmamış.', 'The server connection isn’t set up.'));
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  // The user no longer exists on the server, so only the local session is left to clear.
  await supabase.auth.signOut({ scope: 'local' });
  resetWorkspace();
}
