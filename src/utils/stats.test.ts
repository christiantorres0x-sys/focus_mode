import { describe, expect, it } from "vitest";
import type { StudySession } from "../types/session";
import { collectSubjects, dayKey, focusMsByTask, goalPercent, sessionsOnDay, summarizeSessions } from "./stats";
import { formatClock, formatDuration } from "./time";

const M = 60_000;
const mk = (id: string, endedAt: number, actualMs: number, status: StudySession["status"], taskId: string | null = null): StudySession => ({
  id, taskId, subject: null, title: null, startedAt: endedAt - actualMs, endedAt, plannedMs: 25 * M, actualMs, status,
});

describe("statistics from stored sessions (FR-30, FR-31, FR-36)", () => {
  const late = new Date(2026, 10, 12, 23, 50).getTime();
  const morning = new Date(2026, 10, 12, 9, 0).getTime();
  const after = new Date(2026, 10, 13, 0, 20).getTime();
  const all = [mk("1", morning, 25 * M, "completed", "t1"), mk("2", late, 10 * M, "interrupted", "t1"), mk("3", after, 25 * M, "completed")];

  it("a session belongs to the local day it ended", () => {
    expect(dayKey(late)).toBe("2026-11-12");
    expect(dayKey(after)).toBe("2026-11-13");
    expect(sessionsOnDay(all, "2026-11-12")).toHaveLength(2);
  });

  it("totals and counts come only from the records", () => {
    expect(summarizeSessions(sessionsOnDay(all, "2026-11-12"))).toEqual({ focusMs: 35 * M, completed: 1, interrupted: 1 });
    expect(summarizeSessions([])).toEqual({ focusMs: 0, completed: 0, interrupted: 0 });
  });

  it("focus time per task", () => {
    expect(focusMsByTask(all).get("t1")).toBe(35 * M);
    expect(focusMsByTask(all).has("x")).toBe(false);
  });

  it("goal percentage is whole, capped at 100 and safe with a zero goal", () => {
    expect(goalPercent(60 * M, 120)).toBe(50);
    expect(goalPercent(500 * M, 120)).toBe(100);
    expect(goalPercent(0, 120)).toBe(0);
    expect(goalPercent(5, 0)).toBe(0);
  });

  it("subjects are collected from tasks and sessions without duplicates", () => {
    const tasks = [{ subject: "Math" }, { subject: null }] as never;
    const sessions = [{ subject: "Art" }, { subject: "Math" }] as never;
    expect(collectSubjects(tasks, sessions)).toEqual(["Art", "Math"]);
  });
});

describe("time formatting", () => {
  it("formats durations for people", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(20_000)).toBe("Under 1 min");
    expect(formatDuration(25 * M)).toBe("25 min");
    expect(formatDuration(65 * M)).toBe("1 h 05 min");
    expect(formatDuration(120 * M)).toBe("2 h 00 min");
  });
  it("formats the clock as MM:SS and never goes negative", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(-3)).toBe("00:00");
  });
});
