// Statistics calculated from stored session records only (FR-36): nothing here
// is hardcoded or invented. All days use the user's local time zone.

import type { StudySession } from "../types/session";
import type { StudyTask } from "../types/task";

const MINUTE_MS = 60_000;

// "2026-11-13" for the local day that contains `ms`.
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// A session belongs to the day it ENDED, so time worked just before midnight
// shows up on the day the session was recorded.
export function sessionDayKey(session: StudySession): string {
  return dayKey(session.endedAt ?? session.startedAt);
}

export function sessionsOnDay(sessions: readonly StudySession[], key: string): StudySession[] {
  return sessions.filter((session) => sessionDayKey(session) === key);
}

export interface SessionSummary {
  focusMs: number; // focus time actually spent (completed + interrupted)
  completed: number;
  interrupted: number;
}

export function summarizeSessions(sessions: readonly StudySession[]): SessionSummary {
  let focusMs = 0;
  let completed = 0;
  let interrupted = 0;
  for (const session of sessions) {
    focusMs += session.actualMs;
    if (session.status === "completed") completed++;
    else interrupted++;
  }
  return { focusMs, completed, interrupted };
}

// Focus time per task id, for "focused X of Y min" on the task list.
export function focusMsByTask(sessions: readonly StudySession[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    if (session.taskId === null) continue;
    totals.set(session.taskId, (totals.get(session.taskId) ?? 0) + session.actualMs);
  }
  return totals;
}

// Goal progress as a whole percentage, capped at 100 for the progress bar.
export function goalPercent(focusMs: number, goalMinutes: number): number {
  if (goalMinutes <= 0) return 0;
  return Math.min(100, Math.round((focusMs / (goalMinutes * MINUTE_MS)) * 100));
}

// Subjects used so far (on tasks and sessions), for suggestions while typing.
export function collectSubjects(tasks: readonly StudyTask[], sessions: readonly StudySession[]): string[] {
  const subjects = new Set<string>();
  for (const task of tasks) if (task.subject) subjects.add(task.subject);
  for (const session of sessions) if (session.subject) subjects.add(session.subject);
  return [...subjects].sort((a, b) => a.localeCompare(b));
}
