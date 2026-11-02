import { useEffect } from 'react';
import { create } from 'zustand';
import { UNTITLED } from '../i18n';
import { useAuth } from '../store/auth';
import { isDirty, useEditor } from '../store/editor';
import { useSettings } from '../store/settings';
import { handleRemoteUpdate } from './actions';
import { serializeDoc } from './doc';
import { supabase } from './supabase';

/**
 * The link between the open canvas and the AI tools connected over MCP (server/mcp.ts):
 * - the canvas, unsaved edits included, goes to live_canvas so get_open_diagram can read it;
 * - edits an AI makes with update_diagram arrive over Realtime and reload the open diagram right away.
 * Nothing is shared unless the user is signed in, has connected an AI tool and kept "share the open flow" on.
 */

type LiveState = {
  /** The account has granted at least one AI tool access (Supabase OAuth grants). */
  aiConnected: boolean;
};

export const useLive = create<LiveState>()(() => ({ aiConnected: false }));

const CONTENT_DELAY = 1000;
/** get_open_diagram warns that flowdraft may be closed after 10 quiet minutes, so an idle open tab checks in sooner. */
const HEARTBEAT = 4 * 60_000;
const GRANT_CHECK_GAP = 60_000;
const GRANT_POLL = 5 * 60_000;

let lastGrantCheck = 0;

/** Asks Supabase whether any AI tool is connected. Throttled unless forced. */
export async function checkAiLink(force = false) {
  if (!supabase || !useAuth.getState().user) {
    useLive.setState({ aiConnected: false });
    return;
  }
  if (!force && Date.now() - lastGrantCheck < GRANT_CHECK_GAP) return;
  lastGrantCheck = Date.now();
  const { data, error } = await supabase.auth.oauth.listGrants();
  if (!error) useLive.setState({ aiConnected: data.length > 0 });
}

/** Removes what was shared, e.g. when the user turns sharing off. */
export async function clearLiveCanvas() {
  const userId = useAuth.getState().user?.id;
  if (!supabase || !userId) return;
  await supabase.from('live_canvas').delete().eq('user_id', userId);
}

/** Keeps `aiConnected` current: on sign-in, when the tab comes back and every few minutes until a tool is connected. */
function useAiLink() {
  const userId = useAuth((s) => s.user?.id);
  const connected = useLive((s) => s.aiConnected);
  useEffect(() => {
    void checkAiLink(true);
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => document.visibilityState === 'visible' && void checkAiLink();
    document.addEventListener('visibilitychange', onVisible);
    // Someone connecting an AI tool usually has this tab open in the background, so check without waiting for focus.
    const timer = connected ? undefined : setInterval(() => void checkAiLink(true), GRANT_POLL);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [userId, connected]);
}

/** Mirrors the open canvas to live_canvas a moment after edits settle. */
function useLiveCanvas() {
  const userId = useAuth((s) => s.user?.id);
  const share = useSettings((s) => s.shareCanvas);
  const connected = useLive((s) => s.aiConnected);

  useEffect(() => {
    const db = supabase;
    if (!db || !userId || !share || !connected) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sentKey = '';
    let sentAt = 0;

    const push = async () => {
      timer = undefined;
      const s = useEditor.getState();
      const row = {
        user_id: userId,
        project_id: s.projectId,
        title: (s.title.trim() || UNTITLED).slice(0, 120),
        content: serializeDoc(s.nodes, s.edges),
        dirty: !!s.projectId && isDirty(s),
      };
      const key = JSON.stringify([row.project_id, row.title, row.dirty, row.content]);
      if (key === sentKey && Date.now() - sentAt < HEARTBEAT - 10_000) return;
      const updatedAt = new Date().toISOString();
      let { error } = await db.from('live_canvas').upsert({ ...row, updated_at: updatedAt });
      // The open project may have been deleted elsewhere; still share the canvas itself.
      if (error?.code === '23503') ({ error } = await db.from('live_canvas').upsert({ ...row, project_id: null, updated_at: updatedAt }));
      if (stopped || error) return;
      sentKey = key;
      sentAt = Date.now();
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void push(), CONTENT_DELAY);
    };
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.nodes === prev.nodes && s.edges === prev.edges && s.title === prev.title && s.projectId === prev.projectId && s.savedRevision === prev.savedRevision) return;
      schedule();
    });
    const onVisible = () => document.visibilityState === 'visible' && schedule();
    document.addEventListener('visibilitychange', onVisible);
    const heartbeat = setInterval(() => document.visibilityState === 'visible' && void push(), HEARTBEAT);
    void push();

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, share, connected]);
}

/** Reloads the open diagram as soon as it changes elsewhere, e.g. when a connected AI tool updates it. */
function useRemoteUpdates() {
  const userId = useAuth((s) => s.user?.id);
  const projectId = useEditor((s) => s.projectId);
  useEffect(() => {
    const db = supabase;
    if (!db || !userId || !projectId) return;
    // By flow, not by owner: someone a flow was shared with to edit needs these updates too.
    const channel = db
      .channel(`fd-live-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, () => {
        void handleRemoteUpdate(projectId);
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [userId, projectId]);
}

export function useLiveLink() {
  useAiLink();
  useLiveCanvas();
  useRemoteUpdates();
}
