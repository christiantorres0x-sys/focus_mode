// Centralized storage service (SRS 5.5). UI and background code should read and
// write chrome.storage.local ONLY through this file.

import { DEFAULT_SETTINGS, isThemeMode, type UserSettings } from "../types/settings";

export const SCHEMA_VERSION = 1;

const KEYS = {
  schemaVersion: "schemaVersion",
  settings: "settings",
} as const;

function intInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// Turns anything found in storage (missing, partial or corrupted) into a valid
// UserSettings object. Invalid fields fall back to their defaults.
export function sanitizeSettings(raw: unknown): UserSettings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    theme: isThemeMode(r.theme) ? r.theme : d.theme,
    focusDuration: intInRange(r.focusDuration, d.focusDuration, 1, 180),
    shortBreakDuration: intInRange(r.shortBreakDuration, d.shortBreakDuration, 1, 60),
    longBreakDuration: intInRange(r.longBreakDuration, d.longBreakDuration, 1, 120),
    longBreakInterval: intInRange(r.longBreakInterval, d.longBreakInterval, 2, 12),
    dailyGoalMinutes: intInRange(r.dailyGoalMinutes, d.dailyGoalMinutes, 5, 1440),
    notificationsEnabled: bool(r.notificationsEnabled, d.notificationsEnabled),
    soundEnabled: bool(r.soundEnabled, d.soundEnabled),
  };
}

export async function getSettings(): Promise<UserSettings> {
  const data = await chrome.storage.local.get(KEYS.settings);
  return sanitizeSettings(data[KEYS.settings]);
}

// Throws if the browser could not save, so callers never show unsaved changes
// as saved (SRS 9.3).
export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const next = sanitizeSettings({ ...current, ...patch });
  await chrome.storage.local.set({ [KEYS.settings]: next });
  return next;
}

// Called by the background worker on install/update. Never overwrites valid data.
export async function initStorage(): Promise<void> {
  const data = await chrome.storage.local.get([KEYS.schemaVersion, KEYS.settings]);
  const settings = sanitizeSettings(data[KEYS.settings]);
  await chrome.storage.local.set({
    [KEYS.schemaVersion]: SCHEMA_VERSION,
    [KEYS.settings]: settings,
  });
}

// Lets UI pages react when settings change (for example in another tab).
export function onSettingsChanged(callback: (settings: UserSettings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area === "local" && KEYS.settings in changes) {
      callback(sanitizeSettings(changes[KEYS.settings].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
