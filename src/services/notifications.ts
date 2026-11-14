// Pure rules for phase-end alerts (FR-37). No browser calls here, so they are easy
// to test. The background worker does the actual notifying.

import { STALE_PHASE_END_MS } from "./timerLogic";
import type { TimerState } from "../types/timer";

export interface PhaseEndAlert {
  title: string;
  message: string;
}

// Did a running phase reach its end time, and recently enough that an alert is
// still useful? A phase that ended long ago (browser was closed, laptop asleep)
// is caught up silently, the same way the timer refuses to auto-start it.
export function endedRecently(saved: TimerState, now: number): boolean {
  return (
    saved.status === "running" &&
    saved.endsAt !== null &&
    saved.endsAt <= now &&
    now - saved.endsAt <= STALE_PHASE_END_MS
  );
}

// The alert text, from the timer state AFTER the phase ended (and after any
// automatic start of the next phase).
export function phaseEndAlert(after: TimerState, minutesFor: (state: TimerState) => number): PhaseEndAlert {
  if (after.phase === "focus") {
    return {
      title: "Break is over",
      message:
        after.status === "running"
          ? `Your next focus session has started (${minutesFor(after)} min).`
          : "Ready for your next focus session?",
    };
  }
  const kind = after.phase === "longBreak" ? "long" : "short";
  return {
    title: "Focus session complete",
    message:
      after.status === "running"
        ? `Your ${kind} break has started (${minutesFor(after)} min).`
        : `Time for a ${kind} break.`,
  };
}
