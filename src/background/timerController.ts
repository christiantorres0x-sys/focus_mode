// Background timer controller. This is the ONLY place that writes the timer
// state. It reads the state, applies a pure rule from timerLogic, updates website
// blocking to match, saves it, and keeps one chrome.alarms alarm pointing at the
// moment the phase ends.

import { appendSessions, getSettings, getTasks, getTimerState, saveTimerState } from "../services/storage";
import { endedRecently } from "../services/notifications";
import { applyCommand, reconcileTimer } from "../services/timerLogic";
import { TEXT_LIMITS, type FocusContext } from "../types/session";
import type { TimerAction, TimerState } from "../types/timer";
import { cleanText } from "../utils/text";
import { syncBlocking } from "./blockingManager";
import { announcePhaseEnd } from "./notifier";
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

// Cleans the details sent by the UI and fills gaps from the chosen task: a missing
// title falls back to the task title, a missing subject to the task subject. A
// task that no longer exists is ignored, so history never points at nothing.
async function resolveContext(raw: FocusContext | undefined): Promise<FocusContext | undefined> {
  if (!raw) return undefined;
  const task = raw.taskId ? (await getTasks()).find((item) => item.id === raw.taskId) : undefined;
  return {
    taskId: task ? task.id : null,
    title: cleanText(raw.title, TEXT_LIMITS.title) ?? task?.title ?? null,
    subject: cleanText(raw.subject, TEXT_LIMITS.subject) ?? task?.subject ?? null,
  };
}

async function update(action: TimerAction, rawContext?: FocusContext): Promise<TimerState> {
  const [saved, settings] = await Promise.all([getTimerState(), getSettings()]);
  const context = action === "start" ? await resolveContext(rawContext) : undefined;
  const now = Date.now();

  // Always catch up on phases that already ended BEFORE applying a command, so
  // the command acts on the real current state.
  const caughtUp = reconcileTimer(saved, settings, now);
  const applied = applyCommand(caughtUp.state, action, settings, now, context);
  const next = applied.state;

  // Focus sessions that ended (completed, or stopped early) are recorded BEFORE
  // the new timer state is saved. Saving a session twice is harmless (same id), so
  // if the worker stops between these two writes, the next run simply repeats them.
  await appendSessions([...caughtUp.sessions, ...applied.sessions]);

  // Website blocking follows the timer (BR-01). It runs on EVERY update, even when
  // nothing changed, which is how blocking is restored after a browser restart
  // (FR-18). Blocking is updated BEFORE the new state is saved so the popup never
  // shows "running" before the rules are really on. syncBlocking never throws.
  await syncBlocking(next);

  if (JSON.stringify(next) !== JSON.stringify(saved)) {
    await saveTimerState(next);
  }
  await syncAlarm(next);

  // Tell the user a phase ended (FR-37). This comes last, after everything is saved,
  // and never throws, so an alert problem cannot affect the timer (FR-40). Because
  // the saved state is no longer "running" after this update, the same ending is
  // never announced twice.
  if (endedRecently(saved, now)) await announcePhaseEnd(caughtUp.state, settings);
  return next;
}

// A user command from the popup or dashboard (start, pause, resume, reset, skip).
export function handleTimerCommand(action: TimerAction, context?: FocusContext): Promise<TimerState> {
  return enqueue(() => update(action, context));
}

// Catch up and re-arm the alarm and blocking. Used on worker start-up, browser
// start-up, alarm events and when a page opens.
export function syncTimer(): Promise<TimerState> {
  return enqueue(() => update("reconcile"));
}
