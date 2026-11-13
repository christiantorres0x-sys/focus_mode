// Pure timer logic: no chrome.* calls, no timers, no storage. Every function
// takes the current state and "now" and returns a NEW state. That makes the
// rules easy to read and easy to test.

import type { TimerAction, TimerPhase, TimerState } from "../types/timer";
import type { UserSettings } from "../types/settings";

const MINUTE_MS = 60_000;

// If a phase ended more than this long ago (for example the browser was closed),
// the next phase is NOT auto-started. The user returns to a ready timer instead
// of one that silently started (and would block sites) while they were away.
export const STALE_PHASE_END_MS = 2 * MINUTE_MS;

export function durationMsFor(phase: TimerPhase, settings: UserSettings): number {
  switch (phase) {
    case "focus":
      return settings.focusDuration * MINUTE_MS;
    case "shortBreak":
      return settings.shortBreakDuration * MINUTE_MS;
    case "longBreak":
      return settings.longBreakDuration * MINUTE_MS;
  }
}

export function createIdleState(phase: TimerPhase = "focus", completedFocusCount = 0): TimerState {
  return { status: "idle", phase, phaseDurationMs: 0, endsAt: null, remainingMs: 0, completedFocusCount };
}

// Total length of the current phase (idle phases follow the current settings).
export function getTotalMs(state: TimerState, settings: UserSettings): number {
  return state.status === "idle" ? durationMsFor(state.phase, settings) : state.phaseDurationMs;
}

// Time left. While running it is computed from the end timestamp, so it is
// always correct no matter how long the popup or worker was closed.
export function getRemainingMs(state: TimerState, settings: UserSettings, now: number): number {
  switch (state.status) {
    case "idle":
      return durationMsFor(state.phase, settings);
    case "paused":
      return state.remainingMs;
    case "running":
      return Math.max(0, (state.endsAt ?? now) - now);
  }
}

function startPhase(state: TimerState, settings: UserSettings, startAt: number): TimerState {
  const duration = durationMsFor(state.phase, settings);
  return { ...state, status: "running", phaseDurationMs: duration, endsAt: startAt + duration, remainingMs: 0 };
}

// A running phase reached its end: move to the next phase.
function completePhase(state: TimerState, settings: UserSettings, now: number): TimerState {
  const endedAt = state.endsAt ?? now;
  const completedFocusCount = state.phase === "focus" ? state.completedFocusCount + 1 : state.completedFocusCount;

  let nextPhase: TimerPhase;
  if (state.phase === "focus") {
    nextPhase = completedFocusCount % settings.longBreakInterval === 0 ? "longBreak" : "shortBreak";
  } else {
    nextPhase = "focus";
  }

  const idle = createIdleState(nextPhase, completedFocusCount);
  const wantsAutoStart = nextPhase === "focus" ? settings.autoStartFocus : settings.autoStartBreaks;
  const isFresh = now - endedAt <= STALE_PHASE_END_MS;

  // Auto-started phases begin at the moment the previous one ended (not "now"),
  // so a slightly late alarm does not stretch the break.
  return wantsAutoStart && isFresh ? startPhase(idle, settings, endedAt) : idle;
}

// Catch up if one or more phases have already ended. Safe to call any time.
export function reconcileTimer(state: TimerState, settings: UserSettings, now: number): TimerState {
  let current = state;
  // The cap is only insurance against an endless loop.
  for (let i = 0; i < 50; i++) {
    if (current.status !== "running" || current.endsAt === null || now < current.endsAt) return current;
    current = completePhase(current, settings, now);
  }
  return current;
}

// Applies a user command. Commands that do not fit the current status are ignored.
export function applyCommand(state: TimerState, action: TimerAction, settings: UserSettings, now: number): TimerState {
  switch (action) {
    case "start":
      if (state.status === "idle") return startPhase(state, settings, now);
      if (state.status === "paused") return applyCommand(state, "resume", settings, now);
      return state;

    case "pause":
      if (state.status !== "running") return state;
      return {
        ...state,
        status: "paused",
        endsAt: null,
        remainingMs: Math.max(0, (state.endsAt ?? now) - now),
      };

    case "resume":
      if (state.status !== "paused") return state;
      return { ...state, status: "running", endsAt: now + state.remainingMs, remainingMs: 0 };

    case "reset":
      // Back to the full length of the SAME phase.
      return createIdleState(state.phase, state.completedFocusCount);

    case "skip":
      // Skipping focus does not count as completing it, so it never earns a long break.
      return createIdleState(state.phase === "focus" ? "shortBreak" : "focus", state.completedFocusCount);

    case "reconcile":
      return state;
  }
}

// ---- Validation of data read from storage (missing or corrupted data) ----

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sanitizeTimerState(raw: unknown): TimerState {
  if (typeof raw !== "object" || raw === null) return createIdleState();
  const r = raw as Record<string, unknown>;

  const phase: TimerPhase =
    r.phase === "focus" || r.phase === "shortBreak" || r.phase === "longBreak" ? r.phase : "focus";
  const count =
    typeof r.completedFocusCount === "number" && Number.isInteger(r.completedFocusCount) && r.completedFocusCount >= 0
      ? r.completedFocusCount
      : 0;

  if (r.status === "running" && isFiniteNumber(r.endsAt) && isFiniteNumber(r.phaseDurationMs) && r.phaseDurationMs > 0) {
    return { status: "running", phase, phaseDurationMs: r.phaseDurationMs, endsAt: r.endsAt, remainingMs: 0, completedFocusCount: count };
  }

  if (
    r.status === "paused" &&
    isFiniteNumber(r.remainingMs) &&
    isFiniteNumber(r.phaseDurationMs) &&
    r.phaseDurationMs > 0 &&
    r.remainingMs > 0 &&
    r.remainingMs <= r.phaseDurationMs
  ) {
    return { status: "paused", phase, phaseDurationMs: r.phaseDurationMs, endsAt: null, remainingMs: r.remainingMs, completedFocusCount: count };
  }

  return createIdleState(phase, count);
}
