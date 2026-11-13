// Centralized storage service (SRS 5.5). UI and background code should read and
// write chrome.storage.local ONLY through this file.

import { DEFAULT_SETTINGS, SETTING_LIMITS, isThemeMode, type UserSettings } from "../types/settings";
import type { TimerState } from "../types/timer";
import {
  DEFAULT_BLOCKING_STATUS,
  SUGGESTED_SITES,
  type BlockedWebsite,
  type BlockingStatus,
} from "../types/blocker";
import { normalizeDomain } from "../utils/domain";
import { sanitizeTimerState } from "./timerLogic";

export const SCHEMA_VERSION = 1;

const KEYS = {
  schemaVersion: "schemaVersion",
  settings: "settings",
  timerState: "timerState",
  blocklist: "blocklist",
  blockingStatus: "blockingStatus",
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
  const data = await chrome.storage.local.get([KEYS.schemaVersion, KEYS.settings, KEYS.blocklist]);
  const settings = sanitizeSettings(data[KEYS.settings]);
  const toSave: Record<string, unknown> = {
    [KEYS.schemaVersion]: SCHEMA_VERSION,
    [KEYS.settings]: settings,
  };
  // First run only: start with the suggested list (FR-10). If the user later
  // empties the list, the key still exists, so we never re-add sites for them.
  if (data[KEYS.blocklist] === undefined) {
    toSave[KEYS.blocklist] = createSuggestedBlocklist();
  }
  await chrome.storage.local.set(toSave);
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

// ---- Blocklist (SRS 6.3) ----

export function createSuggestedBlocklist(): BlockedWebsite[] {
  return SUGGESTED_SITES.map(({ domain, category }) => ({
    id: crypto.randomUUID(),
    domain,
    category,
    enabled: true,
  }));
}

// Keeps only valid entries, normalizes their domains, and drops duplicates.
export function sanitizeBlocklist(raw: unknown): BlockedWebsite[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: BlockedWebsite[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.domain !== "string") continue;
    const parsed = normalizeDomain(r.domain);
    if (!parsed.ok || seen.has(parsed.domain)) continue;
    seen.add(parsed.domain);
    result.push({
      id: typeof r.id === "string" && r.id !== "" ? r.id : `site-${parsed.domain}`,
      domain: parsed.domain,
      category: typeof r.category === "string" && r.category !== "" ? r.category : null,
      enabled: typeof r.enabled === "boolean" ? r.enabled : true,
    });
  }
  return result;
}

export async function getBlocklist(): Promise<BlockedWebsite[]> {
  const data = await chrome.storage.local.get(KEYS.blocklist);
  return sanitizeBlocklist(data[KEYS.blocklist]);
}

// Throws if the browser could not save (SRS 9.3).
export async function saveBlocklist(sites: BlockedWebsite[]): Promise<void> {
  await chrome.storage.local.set({ [KEYS.blocklist]: sites });
}

export function onBlocklistChanged(callback: (sites: BlockedWebsite[]) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area === "local" && KEYS.blocklist in changes) {
      callback(sanitizeBlocklist(changes[KEYS.blocklist].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ---- Blocking status (written by the background worker only) ----

export function sanitizeBlockingStatus(raw: unknown): BlockingStatus {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_BLOCKING_STATUS };
  const r = raw as Record<string, unknown>;
  const d = DEFAULT_BLOCKING_STATUS;
  return {
    active: bool(r.active, d.active),
    ruleCount: typeof r.ruleCount === "number" && Number.isInteger(r.ruleCount) && r.ruleCount >= 0 ? r.ruleCount : 0,
    hostAccess: bool(r.hostAccess, d.hostAccess),
    error: typeof r.error === "string" && r.error !== "" ? r.error : null,
  };
}

export async function getBlockingStatus(): Promise<BlockingStatus> {
  const data = await chrome.storage.local.get(KEYS.blockingStatus);
  return sanitizeBlockingStatus(data[KEYS.blockingStatus]);
}

export async function saveBlockingStatus(status: BlockingStatus): Promise<void> {
  await chrome.storage.local.set({ [KEYS.blockingStatus]: status });
}

export function onBlockingStatusChanged(callback: (status: BlockingStatus) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area === "local" && KEYS.blockingStatus in changes) {
      callback(sanitizeBlockingStatus(changes[KEYS.blockingStatus].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
