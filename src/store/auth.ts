import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useEditor } from './editor';
import { useSettings } from './settings';

type AuthMode = 'login' | 'register';

type AuthState = {
  user: User | null;
  ready: boolean;
  modal: { mode: AuthMode; reason: string } | null;
  /** Action the user was trying to do before being asked to sign in. */
  pending: (() => void) | null;
};

export const useAuth = create<AuthState>()(() => ({
  user: null,
  ready: !supabase,
  modal: null,
  pending: null,
}));

export function initAuth() {
  if (!supabase) return;
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

export function openAuth(mode: AuthMode) {
  useAuth.setState({ modal: { mode, reason: '' }, pending: null });
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

export async function signOut() {
  await supabase?.auth.signOut();
  useSettings.getState().setAutosave(false);
  useEditor.setState({ projectId: null, savedRevision: -1 });
}
