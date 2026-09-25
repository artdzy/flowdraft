import type { FlowDoc } from '../flow/types';
import { UNTITLED } from '../i18n';
import { parseDoc } from './doc';

const KEY = 'flowdraft:draft:v1';

export type Draft = { title: string; projectId: string | null; dirty: boolean; doc: FlowDoc };

/** The canvas is always mirrored to this device so anonymous work survives a refresh. */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { title?: unknown; projectId?: unknown; dirty?: unknown; doc?: unknown };
    const doc = parseDoc(parsed.doc);
    if (!doc) return null;
    return {
      doc,
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.slice(0, 120) : UNTITLED,
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId : null,
      dirty: parsed.dirty === true,
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Quota or privacy mode: the canvas still works, it just won't survive a refresh.
  }
}
