// Background timer controller. This is the ONLY place that writes the timer
// state. It reads the state, applies a pure rule from timerLogic, updates website
// blocking to match, saves it, and keeps one chrome.alarms alarm pointing at the
// moment the phase ends.

import { getSettings, getTimerState, saveTimerState } from "../services/storage";
import { applyCommand, reconcileTimer } from "../services/timerLogic";
import type { TimerAction, TimerState } from "../types/timer";
import { syncBlocking } from "./blockingManager";
import { enqueue } from "./queue";

export const PHASE_END_ALARM = "focusmode:phase-end";

// Alarms can be cleared when the browser restarts, so we re-create the alarm
// from the saved state every time the worker runs.
async function syncAlarm(state: TimerState): Promise<void> {
  if (state.status === "running" && state.endsAt !== null) {
    await chrome.alarms.create(PHASE_END_ALARM, { when: state.endsAt });
  } else {
    await chrome.alarms.clear(PHASE_END_ALARM);
  }
}

async function update(action: TimerAction): Promise<TimerState> {
  const [saved, settings] = await Promise.all([getTimerState(), getSettings()]);
  const now = Date.now();

  // Always catch up on phases that already ended BEFORE applying a command, so
  // the command acts on the real current state.
  const caughtUp = reconcileTimer(saved, settings, now);
  const next = applyCommand(caughtUp, action, settings, now);

  // Website blocking follows the timer (BR-01). It runs on EVERY update, even when
  // nothing changed, which is how blocking is restored after a browser restart
  // (FR-18). Blocking is updated BEFORE the new state is saved so the popup never
  // shows "running" before the rules are really on. syncBlocking never throws.
  await syncBlocking(next);

  if (JSON.stringify(next) !== JSON.stringify(saved)) {
    await saveTimerState(next);
  }
  await syncAlarm(next);
  return next;
}

// A user command from the popup or dashboard (start, pause, resume, reset, skip).
export function handleTimerCommand(action: TimerAction): Promise<TimerState> {
  return enqueue(() => update(action));
}

// Catch up and re-arm the alarm and blocking. Used on worker start-up, browser
// start-up, alarm events and when a page opens.
export function syncTimer(): Promise<TimerState> {
  return enqueue(() => update("reconcile"));
}
