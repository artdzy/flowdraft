import { create } from 'zustand';

const KEY = 'flowdraft:settings:v1';

type Settings = {
  autosave: boolean;
  /** Lets connected AI tools see the open canvas (see src/lib/live.ts). On by default; only used while an AI tool is connected. */
  shareCanvas: boolean;
};

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { autosave: parsed.autosave === true, shareCanvas: parsed.shareCanvas !== false };
    }
  } catch {
    // Storage can be unavailable (private mode); fall back to defaults.
  }
  return { autosave: false, shareCanvas: true };
}

function write(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Ignore: settings are a per-device convenience.
  }
}

type SettingsStore = Settings & {
  setAutosave: (on: boolean) => void;
  setShareCanvas: (on: boolean) => void;
};

export const useSettings = create<SettingsStore>()((set, get) => ({
  ...read(),
  setAutosave: (autosave) => {
    set({ autosave });
    write({ autosave, shareCanvas: get().shareCanvas });
  },
  setShareCanvas: (shareCanvas) => {
    set({ shareCanvas });
    write({ autosave: get().autosave, shareCanvas });
  },
}));
