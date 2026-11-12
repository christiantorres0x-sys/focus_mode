// UserSettings model from SRS section 6.1.
// All durations are stored in minutes.

export type ThemeMode = "light" | "dark" | "system";

export interface UserSettings {
  theme: ThemeMode;
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number; // a long break after this many completed focus sessions
  dailyGoalMinutes: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

// SRS FR-02 and FR-04 define the timer defaults. The daily goal default
// (120 minutes) is not in the SRS: it is an assumption the user can change.
export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  dailyGoalMinutes: 120,
  notificationsEnabled: true,
  soundEnabled: false,
};

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}
