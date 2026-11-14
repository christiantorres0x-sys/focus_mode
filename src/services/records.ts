// Validation of tasks, sessions and focus context read from storage (SRS 6.6, 9.2).
// Anything missing or corrupted is repaired or dropped, never trusted.

import { EMPTY_FOCUS_CONTEXT, TEXT_LIMITS, type FocusContext, type StudySession } from "../types/session";
import { TASK_LIMITS, type StudyTask } from "../types/task";
import { cleanText } from "../utils/text";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function sanitizeFocusContext(raw: unknown): FocusContext {
  const r = asRecord(raw);
  if (!r) return { ...EMPTY_FOCUS_CONTEXT };
  return {
    title: cleanText(r.title, TEXT_LIMITS.title),
    subject: cleanText(r.subject, TEXT_LIMITS.subject),
    taskId: typeof r.taskId === "string" && r.taskId !== "" ? r.taskId : null,
  };
}

export function sanitizeTasks(raw: unknown): StudyTask[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: StudyTask[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    if (!r || typeof r.id !== "string" || r.id === "" || seen.has(r.id)) continue;
    const title = cleanText(r.title, TASK_LIMITS.title);
    if (title === null) continue;
    seen.add(r.id);

    const completed = r.completed === true;
    const estimate = r.estimatedMinutes;
    result.push({
      id: r.id,
      title,
      subject: cleanText(r.subject, TASK_LIMITS.subject),
      estimatedMinutes:
        typeof estimate === "number" &&
        Number.isInteger(estimate) &&
        estimate >= TASK_LIMITS.estimateMin &&
        estimate <= TASK_LIMITS.estimateMax
          ? estimate
          : null,
      completed,
      createdAt: isFiniteNumber(r.createdAt) ? r.createdAt : 0,
      completedAt: completed && isFiniteNumber(r.completedAt) ? r.completedAt : null,
    });
  }
  return result;
}

// Valid sessions only, oldest first, without duplicate ids.
export function sanitizeSessions(raw: unknown): StudySession[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: StudySession[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    if (!r || typeof r.id !== "string" || r.id === "" || seen.has(r.id)) continue;
    if (r.status !== "completed" && r.status !== "interrupted") continue;
    if (!isFiniteNumber(r.startedAt) || !isFiniteNumber(r.plannedMs) || r.plannedMs <= 0) continue;
    if (!isFiniteNumber(r.actualMs) || r.actualMs < 0) continue;
    seen.add(r.id);
    result.push({
      id: r.id,
      taskId: typeof r.taskId === "string" && r.taskId !== "" ? r.taskId : null,
      subject: cleanText(r.subject, TEXT_LIMITS.subject),
      title: cleanText(r.title, TEXT_LIMITS.title),
      startedAt: r.startedAt,
      endedAt: isFiniteNumber(r.endedAt) ? r.endedAt : null,
      plannedMs: r.plannedMs,
      // A session can never have more focus time than it was planned for.
      actualMs: Math.min(r.actualMs, r.plannedMs),
      status: r.status,
    });
  }
  return result.sort((a, b) => a.startedAt - b.startedAt);
}
