// Analytics for the Insights page (FR-30..FR-36). Everything is calculated from
// stored session records; days use the user's local time zone.

import type { StudySession } from "../types/session";
import { dayKey, sessionDayKey, summarizeSessions, type SessionSummary } from "./stats";

export const NO_SUBJECT = "No subject";

// The last `count` local days, oldest first, ending with the day of `now`.
// Built from calendar dates (not by subtracting 24 h) so daylight-saving changes
// cannot skip or repeat a day.
export function lastDays(count: number, now: number): string[] {
  const today = new Date(now);
  const keys: string[] = [];
  for (let back = count - 1; back >= 0; back--) {
    keys.push(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, 12).getTime()));
  }
  return keys;
}

// The `count` days immediately before the range returned by lastDays(count, now).
export function previousDays(count: number, now: number): string[] {
  const today = new Date(now);
  const keys: string[] = [];
  for (let back = count * 2 - 1; back >= count; back--) {
    keys.push(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, 12).getTime()));
  }
  return keys;
}

export function sessionsInDays(sessions: readonly StudySession[], keys: readonly string[]): StudySession[] {
  const wanted = new Set(keys);
  return sessions.filter((session) => wanted.has(sessionDayKey(session)));
}

export interface DayPoint extends SessionSummary {
  key: string;
}

// One point per day, including days with no sessions (zeros), so charts have no gaps.
export function dailySeries(sessions: readonly StudySession[], keys: readonly string[]): DayPoint[] {
  const byDay = new Map<string, StudySession[]>();
  for (const session of sessions) {
    const key = sessionDayKey(session);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  return keys.map((key) => ({ key, ...summarizeSessions(byDay.get(key) ?? []) }));
}

export interface SubjectShare {
  subject: string;
  focusMs: number;
  share: number; // 0..1 of the total focus time in the range
}

export function subjectBreakdown(sessions: readonly StudySession[]): SubjectShare[] {
  const totals = new Map<string, number>();
  let all = 0;
  for (const session of sessions) {
    const subject = session.subject ?? NO_SUBJECT;
    totals.set(subject, (totals.get(subject) ?? 0) + session.actualMs);
    all += session.actualMs;
  }
  return [...totals.entries()]
    .map(([subject, focusMs]) => ({ subject, focusMs, share: all > 0 ? focusMs / all : 0 }))
    .sort((a, b) => b.focusMs - a.focusMs || a.subject.localeCompare(b.subject));
}

export interface PeriodSummary extends SessionSummary {
  days: number;
  averageMs: number; // per day in the range
  bestDay: DayPoint | null; // day with the most focus time (null if none)
  completionRate: number | null; // completed / all sessions, null with no sessions
}

export function summarizePeriod(sessions: readonly StudySession[], series: readonly DayPoint[]): PeriodSummary {
  const base = summarizeSessions(sessions);
  const best = series.reduce<DayPoint | null>((top, day) => (day.focusMs > (top?.focusMs ?? 0) ? day : top), null);
  const total = base.completed + base.interrupted;
  return {
    ...base,
    days: series.length,
    averageMs: series.length > 0 ? base.focusMs / series.length : 0,
    bestDay: best,
    completionRate: total > 0 ? base.completed / total : null,
  };
}

// Percent change versus the previous period, or null when there is nothing to compare.
export function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface Streaks {
  current: number;
  longest: number;
  todayMet: boolean;
}

// Streak rule (FR-35, documented): a day counts when its focus time reaches the
// CURRENT daily goal. The current streak is the run of counting days ending today,
// or ending yesterday if today's goal is not reached yet (a streak only ends once
// a whole day has passed without reaching the goal).
export function computeStreaks(sessions: readonly StudySession[], goalMinutes: number, now: number): Streaks {
  const goalMs = goalMinutes * 60_000;
  const perDay = new Map<string, number>();
  for (const session of sessions) {
    const key = sessionDayKey(session);
    perDay.set(key, (perDay.get(key) ?? 0) + session.actualMs);
  }
  const met = (key: string) => goalMs > 0 && (perDay.get(key) ?? 0) >= goalMs;

  const today = new Date(now);
  const keyBack = (back: number) =>
    dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, 12).getTime());

  const todayMet = met(keyBack(0));
  let current = 0;
  for (let back = todayMet ? 0 : 1; met(keyBack(back)); back++) current++;

  // Longest run: walk the recorded days in order and count consecutive calendar days.
  const metDays = [...perDay.keys()].filter(met).sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of metDays) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    const nextDay: Date | null = previous && new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + 1, 12);
    run = nextDay && dayKey(nextDay.getTime()) === key ? run + 1 : 1;
    previous = date;
    longest = Math.max(longest, run);
  }
  return { current, longest: Math.max(longest, current), todayMet };
}

export type HistoryFilter = "all" | "completed" | "interrupted";

export function filterHistory(sessions: readonly StudySession[], filter: HistoryFilter): StudySession[] {
  return sessions
    .filter((session) => filter === "all" || session.status === filter)
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
}
