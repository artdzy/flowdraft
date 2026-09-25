import { create } from 'zustand';

const KEY = 'flowdraft:settings:v1';

type Settings = { autosave: boolean };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { autosave: parsed.autosave === true };
    }
  } catch {
    // Storage can be unavailable (private mode); fall back to defaults.
  }
  return { autosave: false };
}

function write(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Ignore: settings are a per-device convenience.
  }
}

export const useSettings = create<Settings & { setAutosave: (on: boolean) => void }>()((set) => ({
  ...read(),
  setAutosave: (autosave) => {
    set({ autosave });
    write({ autosave });
  },
}));
