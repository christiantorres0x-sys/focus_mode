// Timer data model and the messages the UI sends to the background worker.

export type TimerPhase = "focus" | "shortBreak" | "longBreak";
export type TimerStatus = "idle" | "running" | "paused";

// The timestamp (endsAt) is the single source of truth while running.
// Nothing here is a "seconds left" counter that has to be ticked down.
export interface TimerState {
  status: TimerStatus;
  phase: TimerPhase;
  phaseDurationMs: number; // length of the current phase; 0 while idle
  endsAt: number | null; // epoch ms when the phase ends; only while running
  remainingMs: number; // time left; only meaningful while paused
  completedFocusCount: number; // finished focus phases, used for long-break timing
}

export const DEFAULT_TIMER_STATE: TimerState = {
  status: "idle",
  phase: "focus",
  phaseDurationMs: 0,
  endsAt: null,
  remainingMs: 0,
  completedFocusCount: 0,
};

export const TIMER_PHASES: readonly TimerPhase[] = ["focus", "shortBreak", "longBreak"];
export const TIMER_STATUSES: readonly TimerStatus[] = ["idle", "running", "paused"];

// "reconcile" changes nothing by itself: it asks the background to catch up if
// a phase has already ended (used when a page opens or a countdown hits zero).
export const TIMER_ACTIONS = ["start", "pause", "resume", "reset", "skip", "reconcile"] as const;
export type TimerAction = (typeof TIMER_ACTIONS)[number];

export interface TimerMessage {
  type: "timer";
  action: TimerAction;
}

export type TimerResponse = { ok: true; state: TimerState } | { ok: false; error: string };

export function isTimerMessage(value: unknown): value is TimerMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.type === "timer" && typeof v.action === "string" && (TIMER_ACTIONS as readonly string[]).includes(v.action);
}
