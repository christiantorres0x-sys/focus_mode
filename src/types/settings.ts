// UserSettings model from SRS section 6.1.
// All durations are stored in minutes.

export type ThemeMode = "light" | "dark" | "system";

export interface UserSettings {
  theme: ThemeMode;
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number; // a long break after this many completed focus sessions
  autoStartBreaks: boolean; // start a break automatically when focus ends (FR-06)
  autoStartFocus: boolean; // start focus automatically when a break ends (FR-06)
  dailyGoalMinutes: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

// SRS FR-02 and FR-04 define the timer defaults. The daily goal and the two
// auto-start options are not in the SRS: they are assumptions the user can change.
export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  dailyGoalMinutes: 120,
  notificationsEnabled: true,
  soundEnabled: false,
};

// Allowed ranges. Shared by validation (storage) and the settings form (UI).
export const SETTING_LIMITS = {
  focusDuration: { min: 1, max: 180 },
  shortBreakDuration: { min: 1, max: 60 },
  longBreakDuration: { min: 1, max: 120 },
  longBreakInterval: { min: 2, max: 12 },
  dailyGoalMinutes: { min: 5, max: 1440 },
} as const;

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}
