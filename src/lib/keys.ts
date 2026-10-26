/** True while the keyboard focus is in a text field or an in-place editor, where canvas shortcuts must stay quiet. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

const lastRun = new Map<string, number>();

/**
 * In the iOS / Mac app a shortcut such as ⌘S or ⌘+ is also a menu bar command (ios/Flowdraft/EditorCommands.swift),
 * so one key press may arrive both from the menu and as a keydown. Whichever comes first runs the action.
 */
export function runOnce(action: string, run: () => void) {
  const now = performance.now();
  if (now - (lastRun.get(action) ?? -Infinity) < 120) return;
  lastRun.set(action, now);
  run();
}
