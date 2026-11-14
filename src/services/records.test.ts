import { describe, expect, it } from "vitest";
import { isTimerMessage } from "../types/timer";
import { sanitizeSessions, sanitizeTasks } from "./records";

const good = { id: "a", taskId: null, subject: " Math ", title: null, startedAt: 2000, endedAt: 3000, plannedMs: 1_500_000, actualMs: 1_500_000, status: "completed" };

describe("sanitizeSessions (SRS 6.5, 9.2)", () => {
  it("drops invalid entries, removes duplicates, sorts by start and clamps actual time", () => {
    const out = sanitizeSessions([
      { ...good, id: "b", startedAt: 5000 },
      good,
      good,
      null,
      7,
      { ...good, id: "c", status: "paused" },
      { ...good, id: "d", plannedMs: 0 },
      { ...good, id: "e", actualMs: -1 },
      { ...good, id: "f", startedAt: "x" },
      { ...good, id: "g", actualMs: 9e9, startedAt: 1 },
    ]);
    expect(out.map((s) => s.id)).toEqual(["g", "a", "b"]);
    expect(out[0].actualMs).toBe(1_500_000);
    expect(out[1].subject).toBe("Math");
  });

  it("anything that is not a list gives an empty list", () => {
    expect(sanitizeSessions("nope")).toEqual([]);
    expect(sanitizeSessions(undefined)).toEqual([]);
  });
});

describe("sanitizeTasks (SRS 6.4)", () => {
  it("repairs fields and drops invalid tasks", () => {
    const out = sanitizeTasks([
      { id: "1", title: "  Read ch. 4 ", subject: "", estimatedMinutes: 30.5, completed: "yes", createdAt: 10 },
      { id: "2", title: "x", estimatedMinutes: 45, completed: true, completedAt: 99, createdAt: 5 },
      { id: "3", title: "   " },
      { title: "no id" },
      { id: "1", title: "duplicate id" },
      4,
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ title: "Read ch. 4", subject: null, estimatedMinutes: null, completed: false });
    expect(out[1]).toMatchObject({ completedAt: 99, estimatedMinutes: 45 });
  });
});

describe("isTimerMessage (only our own pages may send commands)", () => {
  const ctx = { title: "Chapter 3", subject: "Math", taskId: "task-1" };
  it("accepts valid messages, with or without details", () => {
    expect(isTimerMessage({ type: "timer", action: "start" })).toBe(true);
    expect(isTimerMessage({ type: "timer", action: "start", context: ctx })).toBe(true);
  });
  it("rejects unknown actions, wrong types and malformed details", () => {
    expect(isTimerMessage({ type: "timer", action: "nuke" })).toBe(false);
    expect(isTimerMessage({ type: "other", action: "start" })).toBe(false);
    expect(isTimerMessage({ type: "timer", action: "start", context: { title: 5, subject: null, taskId: null } })).toBe(false);
    expect(isTimerMessage({ type: "timer", action: "start", context: "x" })).toBe(false);
    expect(isTimerMessage(null)).toBe(false);
  });
});
