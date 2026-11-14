// Pure timer logic: no chrome.* calls, no timers, no storage. Every function
// takes the current state and "now" and returns a NEW state, plus any focus
// sessions that just ended. That makes the rules easy to read and to test.

import type { TimerAction, TimerPhase, TimerState } from "../types/timer";
import type { UserSettings } from "../types/settings";
import { EMPTY_FOCUS_CONTEXT, MIN_RECORDED_MS, type FocusContext, type SessionStatus, type StudySession } from "../types/session";
import { sanitizeFocusContext } from "./records";

const MINUTE_MS = 60_000;

// If a phase ended more than this long ago (for example the browser was closed),
// the next phase is NOT auto-started. The user returns to a ready timer instead
// of one that silently started (and would block sites) while they were away.
export const STALE_PHASE_END_MS = 2 * MINUTE_MS;

// The result of every change: the new state and the sessions that ended because of it.
export interface TimerUpdate {
  state: TimerState;
  sessions: StudySession[];
}

const noSessions = (state: TimerState): TimerUpdate => ({ state, sessions: [] });

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

export function createIdleState(
  phase: TimerPhase = "focus",
  completedFocusCount = 0,
  intent: FocusContext = EMPTY_FOCUS_CONTEXT,
): TimerState {
  return {
    status: "idle",
    phase,
    phaseDurationMs: 0,
    endsAt: null,
    remainingMs: 0,
    completedFocusCount,
    intent,
    sessionStartedAt: null,
  };
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

// Time left in a phase that has started (0 when idle).
function timeLeftMs(state: TimerState, at: number): number {
  if (state.status === "running") return Math.max(0, (state.endsAt ?? at) - at);
  if (state.status === "paused") return state.remainingMs;
  return 0;
}

function startPhase(state: TimerState, settings: UserSettings, startAt: number, intent?: FocusContext): TimerState {
  const duration = durationMsFor(state.phase, settings);
  return {
    ...state,
    status: "running",
    phaseDurationMs: duration,
    endsAt: startAt + duration,
    remainingMs: 0,
    intent: intent ?? state.intent,
    sessionStartedAt: state.phase === "focus" ? startAt : null,
  };
}

// Builds the record for a focus session that just ended, or null if there is
// nothing to record (not a focus session, or stopped after under a minute).
//  - completed:   the full planned time finished            (BR-02)
//  - interrupted: stopped or skipped early; actual time is only the time that
//                 really ran. Paused time is never counted.   (BR-03, FR-09)
function recordSession(state: TimerState, status: SessionStatus, endedAt: number): StudySession | null {
  if (state.phase !== "focus" || state.status === "idle" || state.sessionStartedAt === null) return null;

  const plannedMs = state.phaseDurationMs;
  const actualMs =
    status === "completed" ? plannedMs : Math.min(plannedMs, Math.max(0, plannedMs - timeLeftMs(state, endedAt)));
  if (status === "interrupted" && actualMs < MIN_RECORDED_MS) return null;

  return {
    // Derived from the start time, so recording the same session twice (for
    // example after the worker restarts mid-save) can never create a duplicate.
    id: `session-${state.sessionStartedAt}`,
    taskId: state.intent.taskId,
    subject: state.intent.subject,
    title: state.intent.title,
    startedAt: state.sessionStartedAt,
    endedAt,
    plannedMs,
    actualMs,
    status,
  };
}

// A running phase reached its end: move to the next phase.
function completePhase(state: TimerState, settings: UserSettings, now: number): TimerUpdate {
  const endedAt = state.endsAt ?? now;
  const record = recordSession(state, "completed", endedAt);
  const completedFocusCount = state.phase === "focus" ? state.completedFocusCount + 1 : state.completedFocusCount;

  let nextPhase: TimerPhase;
  if (state.phase === "focus") {
    nextPhase = completedFocusCount % settings.longBreakInterval === 0 ? "longBreak" : "shortBreak";
  } else {
    nextPhase = "focus";
  }

  const idle = createIdleState(nextPhase, completedFocusCount, state.intent);
  const wantsAutoStart = nextPhase === "focus" ? settings.autoStartFocus : settings.autoStartBreaks;
  const isFresh = now - endedAt <= STALE_PHASE_END_MS;

  // Auto-started phases begin at the moment the previous one ended (not "now"),
  // so a slightly late alarm does not stretch the break.
  const next = wantsAutoStart && isFresh ? startPhase(idle, settings, endedAt) : idle;
  return { state: next, sessions: record ? [record] : [] };
}

// Catch up if one or more phases have already ended. Safe to call any time.
export function reconcileTimer(state: TimerState, settings: UserSettings, now: number): TimerUpdate {
  let current = state;
  const sessions: StudySession[] = [];
  // The cap is only insurance against an endless loop.
  for (let i = 0; i < 50; i++) {
    if (current.status !== "running" || current.endsAt === null || now < current.endsAt) break;
    const step = completePhase(current, settings, now);
    current = step.state;
    sessions.push(...step.sessions);
  }
  return { state: current, sessions };
}

// Applies a user command. Commands that do not fit the current status are ignored.
// `context` is only used by "start" and only for focus phases.
export function applyCommand(
  state: TimerState,
  action: TimerAction,
  settings: UserSettings,
  now: number,
  context?: FocusContext,
): TimerUpdate {
  switch (action) {
    case "start":
      if (state.status === "idle") {
        return noSessions(startPhase(state, settings, now, state.phase === "focus" ? context : undefined));
      }
      if (state.status === "paused") return applyCommand(state, "resume", settings, now);
      return noSessions(state);

    case "pause":
      if (state.status !== "running") return noSessions(state);
      return noSessions({
        ...state,
        status: "paused",
        endsAt: null,
        remainingMs: Math.max(0, (state.endsAt ?? now) - now),
      });

    case "resume":
      if (state.status !== "paused") return noSessions(state);
      return noSessions({ ...state, status: "running", endsAt: now + state.remainingMs, remainingMs: 0 });

    case "reset": {
      // Stopping a focus session early records it as interrupted (FR-23, BR-03).
      const record = recordSession(state, "interrupted", now);
      // Back to the full length of the SAME phase.
      return {
        state: createIdleState(state.phase, state.completedFocusCount, state.intent),
        sessions: record ? [record] : [],
      };
    }

    case "skip": {
      // Skipping focus does not count as completing it, so it never earns a long break.
      const record = recordSession(state, "interrupted", now);
      return {
        state: createIdleState(state.phase === "focus" ? "shortBreak" : "focus", state.completedFocusCount, state.intent),
        sessions: record ? [record] : [],
      };
    }

    case "reconcile":
      return noSessions(state);
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
  const intent = sanitizeFocusContext(r.intent); // older saved states have no intent

  if (r.status === "running" && isFiniteNumber(r.endsAt) && isFiniteNumber(r.phaseDurationMs) && r.phaseDurationMs > 0) {
    return {
      status: "running",
      phase,
      phaseDurationMs: r.phaseDurationMs,
      endsAt: r.endsAt,
      remainingMs: 0,
      completedFocusCount: count,
      intent,
      sessionStartedAt: phase === "focus" && isFiniteNumber(r.sessionStartedAt) ? r.sessionStartedAt : null,
    };
  }

  if (
    r.status === "paused" &&
    isFiniteNumber(r.remainingMs) &&
    isFiniteNumber(r.phaseDurationMs) &&
    r.phaseDurationMs > 0 &&
    r.remainingMs > 0 &&
    r.remainingMs <= r.phaseDurationMs
  ) {
    return {
      status: "paused",
      phase,
      phaseDurationMs: r.phaseDurationMs,
      endsAt: null,
      remainingMs: r.remainingMs,
      completedFocusCount: count,
      intent,
      sessionStartedAt: phase === "focus" && isFiniteNumber(r.sessionStartedAt) ? r.sessionStartedAt : null,
    };
  }

  return createIdleState(phase, count, intent);
}
