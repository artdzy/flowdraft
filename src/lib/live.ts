import { useEffect } from 'react';
import { create } from 'zustand';
import { t, UNTITLED } from '../i18n';
import { useAuth } from '../store/auth';
import { isDirty, useEditor } from '../store/editor';
import { useSettings } from '../store/settings';
import { toast } from '../store/ui';
import { handleRemoteUpdate } from './actions';
import { serializeDoc } from './doc';
import { renderPreview } from './exporter';
import { parseReview, type Review } from './review';
import { supabase } from './supabase';

/**
 * The link between the open canvas and the AI tools connected over MCP (server/mcp.ts):
 * - the canvas, unsaved edits included, and a small picture of it go to live_canvas so get_open_diagram can read them;
 * - reviews an AI leaves with add_review arrive over Realtime and are shown on the canvas (ReviewPanel, ReviewPins);
 * - edits an AI makes with update_diagram reload the open diagram right away.
 * Nothing is shared unless the user is signed in, has connected an AI tool and kept "share the open flow" on.
 */

type LiveState = {
  /** The account has granted at least one AI tool access (Supabase OAuth grants). */
  aiConnected: boolean;
  review: Review | null;
  collapsed: boolean;
  /** Index of the review item highlighted in the panel and on the canvas. */
  focus: number | null;
};

export const useLive = create<LiveState>()(() => ({ aiConnected: false, review: null, collapsed: false, focus: null }));

const CONTENT_DELAY = 1000;
const PREVIEW_DELAY = 4000;
/** get_open_diagram warns that flowdraft may be closed after 10 quiet minutes, so an idle open tab checks in sooner. */
const HEARTBEAT = 4 * 60_000;
const GRANT_CHECK_GAP = 60_000;
const GRANT_POLL = 5 * 60_000;
/** A review of a canvas that was never saved only makes sense for a while. */
const UNSAVED_REVIEW_TTL = 12 * 60 * 60_000;

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

export async function dismissReview() {
  const review = useLive.getState().review;
  useLive.setState({ review: null, focus: null });
  if (review && supabase) await supabase.from('reviews').delete().eq('id', review.id);
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

/** Mirrors the open canvas to live_canvas, and a picture of it once edits settle. */
function useLiveCanvas() {
  const userId = useAuth((s) => s.user?.id);
  const share = useSettings((s) => s.shareCanvas);
  const connected = useLive((s) => s.aiConnected);

  useEffect(() => {
    const db = supabase;
    if (!db || !userId || !share || !connected) return;
    let stopped = false;
    let contentTimer: ReturnType<typeof setTimeout> | undefined;
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    let sentKey = '';
    let sentAt = 0;
    let previewKey = '';
    let rowReady = false;

    const current = () => {
      const s = useEditor.getState();
      const row = {
        user_id: userId,
        project_id: s.projectId,
        title: (s.title.trim() || UNTITLED).slice(0, 120),
        content: serializeDoc(s.nodes, s.edges),
        dirty: !!s.projectId && isDirty(s),
      };
      return { row, key: JSON.stringify([row.project_id, row.title, row.dirty, row.content]) };
    };

    const pushContent = async () => {
      contentTimer = undefined;
      const { row, key } = current();
      if (key === sentKey && Date.now() - sentAt < HEARTBEAT - 10_000) return;
      const updatedAt = new Date().toISOString();
      let { error } = await db.from('live_canvas').upsert({ ...row, updated_at: updatedAt });
      // The open project may have been deleted elsewhere; still share the canvas itself.
      if (error?.code === '23503') ({ error } = await db.from('live_canvas').upsert({ ...row, project_id: null, updated_at: updatedAt }));
      if (stopped || error) return;
      rowReady = true;
      sentKey = key;
      sentAt = Date.now();
      schedulePreview();
    };

    const pushPreview = async () => {
      previewTimer = undefined;
      if (!rowReady || document.visibilityState !== 'visible') return;
      const { key } = current();
      if (key === previewKey) return;
      let preview: string | null = null;
      try {
        preview = await renderPreview(useEditor.getState().nodes);
      } catch {
        return;
      }
      if (stopped) return;
      const { error } = await db
        .from('live_canvas')
        .update({ preview, preview_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (!error) previewKey = key;
    };

    const scheduleContent = () => {
      clearTimeout(contentTimer);
      contentTimer = setTimeout(() => void pushContent(), CONTENT_DELAY);
    };
    function schedulePreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => void pushPreview(), PREVIEW_DELAY);
    }

    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.nodes === prev.nodes && s.edges === prev.edges && s.title === prev.title && s.projectId === prev.projectId && s.savedRevision === prev.savedRevision) return;
      scheduleContent();
      schedulePreview();
    });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleContent();
      schedulePreview();
    };
    document.addEventListener('visibilitychange', onVisible);
    const heartbeat = setInterval(() => document.visibilityState === 'visible' && void pushContent(), HEARTBEAT);
    void pushContent();

    return () => {
      stopped = true;
      clearTimeout(contentTimer);
      clearTimeout(previewTimer);
      clearInterval(heartbeat);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, share, connected]);
}

async function loadReview(projectId: string | null) {
  if (!supabase) return;
  let query = supabase.from('reviews').select('id,project_id,summary,items,created_at');
  query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null);
  const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  // The user may have opened something else meanwhile.
  if (useEditor.getState().projectId !== projectId) return;
  let review = data ? parseReview(data) : null;
  if (review && !projectId && Date.now() - Date.parse(review.created_at) > UNSAVED_REVIEW_TTL) review = null;
  useLive.setState({ review, focus: null });
}

/** Shows the review of whatever is open, live: new reviews and edits by AI tools arrive over Realtime. */
function useReviewFeed() {
  const userId = useAuth((s) => s.user?.id);
  const fitRequest = useEditor((s) => s.fitRequest);

  // A document was loaded (fitRequest is bumped by every loadDoc): show its review, if any.
  useEffect(() => {
    if (!userId) {
      useLive.setState({ review: null, focus: null });
      return;
    }
    void loadReview(useEditor.getState().projectId);
  }, [userId, fitRequest]);

  // A canvas saved for the first time takes the review it got while unsaved along.
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        const review = useLive.getState().review;
        if (prev.projectId || !s.projectId || s.fitRequest !== prev.fitRequest || !review || review.project_id) return;
        useLive.setState({ review: { ...review, project_id: s.projectId } });
        void supabase?.from('reviews').update({ project_id: s.projectId }).eq('id', review.id);
      }),
    [],
  );

  useEffect(() => {
    const db = supabase;
    if (!db || !userId) return;
    const channel = db
      .channel(`fd-live-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews', filter: `user_id=eq.${userId}` }, (payload) => {
        const review = parseReview(payload.new);
        if (!review || review.project_id !== useEditor.getState().projectId) return;
        useLive.setState({ review, collapsed: false, focus: null });
        toast(t('AI kritiği geldi', 'AI review is in'));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as { id?: unknown };
        if (typeof row.id === 'string') void handleRemoteUpdate(row.id);
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [userId]);
}

export function useLiveLink() {
  useAiLink();
  useLiveCanvas();
  useReviewFeed();
}
