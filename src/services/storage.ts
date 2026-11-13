// Centralized storage service (SRS 5.5). UI and background code should read and
// write chrome.storage.local ONLY through this file.

import { DEFAULT_SETTINGS, SETTING_LIMITS, isThemeMode, type UserSettings } from "../types/settings";
import type { TimerState } from "../types/timer";
import { sanitizeTimerState } from "./timerLogic";

export const SCHEMA_VERSION = 1;

const KEYS = {
  schemaVersion: "schemaVersion",
  settings: "settings",
  timerState: "timerState",
} as const;

type LimitedKey = keyof typeof SETTING_LIMITS;

// Accepts a whole number inside the allowed range, otherwise uses the fallback.
function limited(value: unknown, key: LimitedKey): number {
  const { min, max } = SETTING_LIMITS[key];
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : DEFAULT_SETTINGS[key];
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
    focusDuration: limited(r.focusDuration, "focusDuration"),
    shortBreakDuration: limited(r.shortBreakDuration, "shortBreakDuration"),
    longBreakDuration: limited(r.longBreakDuration, "longBreakDuration"),
    longBreakInterval: limited(r.longBreakInterval, "longBreakInterval"),
    autoStartBreaks: bool(r.autoStartBreaks, d.autoStartBreaks),
    autoStartFocus: bool(r.autoStartFocus, d.autoStartFocus),
    dailyGoalMinutes: limited(r.dailyGoalMinutes, "dailyGoalMinutes"),
    notificationsEnabled: bool(r.notificationsEnabled, d.notificationsEnabled),
    soundEnabled: bool(r.soundEnabled, d.soundEnabled),
  };
}

// ---- Settings ----

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

// ---- Timer state ----
// Only the background worker should WRITE the timer state; the UI reads it and
// sends commands instead (see background/timerController.ts).

export async function getTimerState(): Promise<TimerState> {
  const data = await chrome.storage.local.get(KEYS.timerState);
  return sanitizeTimerState(data[KEYS.timerState]);
}

export async function saveTimerState(state: TimerState): Promise<void> {
  await chrome.storage.local.set({ [KEYS.timerState]: state });
}

export function onTimerStateChanged(callback: (state: TimerState) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area === "local" && KEYS.timerState in changes) {
      callback(sanitizeTimerState(changes[KEYS.timerState].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
