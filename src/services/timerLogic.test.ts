import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type UserSettings } from "../types/settings";
import type { FocusContext } from "../types/session";
import type { TimerState } from "../types/timer";
import {
  STALE_PHASE_END_MS,
  applyCommand,
  createIdleState,
  getRemainingMs,
  reconcileTimer,
  sanitizeTimerState,
} from "./timerLogic";

const M = 60_000;
const T0 = 1_800_000_000_000;
const SETTINGS: UserSettings = { ...DEFAULT_SETTINGS };
const CTX: FocusContext = { title: "Chapter 3", subject: "Math", taskId: "task-1" };

const start = (state: TimerState = createIdleState(), ctx: FocusContext = CTX, at = T0, s = SETTINGS) =>
  applyCommand(state, "start", s, at, ctx).state;

describe("starting, pausing and resuming (FR-01..FR-05)", () => {
  it("start runs the focus phase and ends exactly one focus duration later", () => {
    const s = start();
    expect(s.status).toBe("running");
    expect(s.phase).toBe("focus");
    expect(s.endsAt).toBe(T0 + 25 * M);
    expect(getRemainingMs(s, SETTINGS, T0 + 5 * M)).toBe(20 * M);
  });

  it("pause freezes the remaining time and resume continues from it", () => {
    const paused = applyCommand(start(), "pause", SETTINGS, T0 + 10 * M).state;
    expect(paused.status).toBe("paused");
    expect(paused.remainingMs).toBe(15 * M);
    expect(getRemainingMs(paused, SETTINGS, T0 + 999 * M)).toBe(15 * M);
    const resumed = applyCommand(paused, "resume", SETTINGS, T0 + 100 * M).state;
    expect(resumed.endsAt).toBe(T0 + 115 * M);
  });

  it("pause, resume and start are ignored in states where they make no sense", () => {
    const idle = createIdleState();
    expect(applyCommand(idle, "pause", SETTINGS, T0).state).toEqual(idle);
    expect(applyCommand(idle, "resume", SETTINGS, T0).state).toEqual(idle);
    const running = start();
    expect(applyCommand(running, "start", SETTINGS, T0 + M).state).toEqual(running);
  });

  it("reconcile on an idle or paused timer changes nothing", () => {
    const idle = createIdleState();
    expect(reconcileTimer(idle, SETTINGS, T0).state).toEqual(idle);
    const paused = applyCommand(start(), "pause", SETTINGS, T0 + M).state;
    expect(reconcileTimer(paused, SETTINGS, T0 + 999 * M).state).toEqual(paused);
  });
});

describe("phase transitions (FR-03, FR-04, FR-06)", () => {
  it("a long break comes after the configured number of completed focus sessions", () => {
    const s = { ...SETTINGS, longBreakInterval: 2, autoStartBreaks: false };
    let state = start(createIdleState("focus", 1), CTX, T0, s);
    state = reconcileTimer(state, s, T0 + 25 * M).state;
    expect(state.phase).toBe("longBreak");
    expect(state.completedFocusCount).toBe(2);
    let first = start(createIdleState("focus", 0), CTX, T0, s);
    first = reconcileTimer(first, s, T0 + 25 * M).state;
    expect(first.phase).toBe("shortBreak");
  });

  it("auto-start breaks on: the break runs from the focus end time; off: it waits", () => {
    const on = reconcileTimer(start(), SETTINGS, T0 + 25 * M + 4000).state;
    expect(on.phase).toBe("shortBreak");
    expect(on.status).toBe("running");
    expect(on.endsAt).toBe(T0 + 30 * M);
    const off = reconcileTimer(start(createIdleState(), CTX, T0, { ...SETTINGS, autoStartBreaks: false }), { ...SETTINGS, autoStartBreaks: false }, T0 + 26 * M).state;
    expect(off.status).toBe("idle");
    expect(off.phase).toBe("shortBreak");
  });

  it("a break that ends returns to an idle focus phase unless auto-start focus is on", () => {
    const s = { ...SETTINGS, shortBreakDuration: 1 };
    const brk = applyCommand(createIdleState("shortBreak", 1), "start", s, T0).state;
    const after = reconcileTimer(brk, s, T0 + M + 1000).state;
    expect(after.phase).toBe("focus");
    expect(after.status).toBe("idle");
  });
});

describe("recording sessions (FR-19..FR-24)", () => {
  it("a finished focus phase records ONE completed session with its details", () => {
    const u = reconcileTimer(start(), SETTINGS, T0 + 25 * M + 4000);
    expect(u.sessions).toEqual([
      { id: `session-${T0}`, taskId: "task-1", subject: "Math", title: "Chapter 3", startedAt: T0, endedAt: T0 + 25 * M, plannedMs: 25 * M, actualMs: 25 * M, status: "completed" },
    ]);
  });

  it("pausing does not change a completed session's length", () => {
    let s = start();
    s = applyCommand(s, "pause", SETTINGS, T0 + 10 * M).state;
    s = applyCommand(s, "resume", SETTINGS, T0 + 180 * M).state;
    const u = reconcileTimer(s, SETTINGS, (s.endsAt ?? 0) + 1);
    expect(u.sessions[0].actualMs).toBe(25 * M);
    expect(u.sessions[0].status).toBe("completed");
    expect(u.sessions[0].startedAt).toBe(T0);
  });

  it("breaks never create sessions", () => {
    const b = applyCommand(createIdleState("shortBreak", 1), "start", SETTINGS, T0).state;
    expect(reconcileTimer(b, SETTINGS, T0 + 5 * M).sessions).toHaveLength(0);
    expect(applyCommand(b, "reset", SETTINGS, T0 + 3 * M).sessions).toHaveLength(0);
    expect(applyCommand(b, "skip", SETTINGS, T0 + 3 * M).sessions).toHaveLength(0);
  });

  it("reset after 10 of 25 minutes records an interrupted 10 minute session", () => {
    const u = applyCommand(start(), "reset", SETTINGS, T0 + 10 * M);
    expect(u.sessions).toHaveLength(1);
    expect(u.sessions[0]).toMatchObject({ status: "interrupted", actualMs: 10 * M, plannedMs: 25 * M, endedAt: T0 + 10 * M });
    expect(u.state).toMatchObject({ status: "idle", phase: "focus", completedFocusCount: 0 });
  });

  it("stopping while paused counts only the time that actually ran", () => {
    const paused = applyCommand(start(), "pause", SETTINGS, T0 + 7 * M).state;
    const u = applyCommand(paused, "reset", SETTINGS, T0 + 500 * M);
    expect(u.sessions[0].actualMs).toBe(7 * M);
  });

  it("pause then resume then stop excludes the paused time", () => {
    let s = start();
    s = applyCommand(s, "pause", SETTINGS, T0 + 5 * M).state;
    s = applyCommand(s, "resume", SETTINGS, T0 + 60 * M).state;
    expect(applyCommand(s, "reset", SETTINGS, T0 + 70 * M).sessions[0].actualMs).toBe(15 * M);
  });

  it("skipping focus is interrupted, goes to a short break and does not count toward a long break", () => {
    const u = applyCommand(start(createIdleState("focus", 3)), "skip", SETTINGS, T0 + 12 * M);
    expect(u.sessions[0]).toMatchObject({ status: "interrupted", actualMs: 12 * M });
    expect(u.state).toMatchObject({ phase: "shortBreak", completedFocusCount: 3 });
  });

  it("stopping under one minute records nothing (accidental click)", () => {
    expect(applyCommand(start(), "reset", SETTINGS, T0 + 59_000).sessions).toHaveLength(0);
    expect(applyCommand(start(), "skip", SETTINGS, T0 + 10_000).sessions).toHaveLength(0);
    expect(applyCommand(start(), "reset", SETTINGS, T0 + 60_000).sessions).toHaveLength(1);
  });

  it("reset or skip while idle records nothing", () => {
    expect(applyCommand(createIdleState(), "reset", SETTINGS, T0).sessions).toHaveLength(0);
    expect(applyCommand(createIdleState(), "skip", SETTINGS, T0).sessions).toHaveLength(0);
  });

  it("the same session always gets the same id, so saving twice is harmless", () => {
    const a = reconcileTimer(start(), SETTINGS, T0 + 26 * M).sessions[0];
    const b = reconcileTimer(start(), SETTINGS, T0 + 30 * M).sessions[0];
    expect(a.id).toBe(b.id);
  });
});

describe("recovery after the browser or worker was away (FR-07, NFR-07, NFR-08)", () => {
  const fast: UserSettings = { ...SETTINGS, focusDuration: 1, shortBreakDuration: 1, autoStartFocus: true };

  it("browser closed for hours: the focus session is completed at its real end time", () => {
    const u = reconcileTimer(start(), SETTINGS, T0 + 9 * 60 * M);
    expect(u.sessions[0]).toMatchObject({ status: "completed", endedAt: T0 + 25 * M });
    expect(u.state.status).toBe("idle");
  });

  it("an alarm that fires late still produces correct timestamps", () => {
    const u = reconcileTimer(start(), SETTINGS, T0 + 25 * M + 90_000);
    expect(u.state.endsAt).toBe(T0 + 30 * M);
  });

  it("the details survive breaks and an auto-started focus continues the same task", () => {
    const u = reconcileTimer(start(createIdleState(), CTX, T0, fast), fast, T0 + 2 * M + 20_000);
    expect(u.sessions).toHaveLength(1);
    expect(u.state).toMatchObject({ phase: "focus", status: "running", intent: CTX, sessionStartedAt: T0 + 2 * M });
    const u2 = reconcileTimer(u.state, fast, T0 + 3 * M + 1);
    expect(u2.sessions[0]).toMatchObject({ taskId: "task-1", id: `session-${T0 + 2 * M}` });
  });

  it("catching up several phases within the limit records one session per finished focus", () => {
    const u = reconcileTimer(start(createIdleState(), CTX, T0, fast), fast, T0 + 3 * M);
    expect(u.sessions).toHaveLength(2);
    expect(new Set(u.sessions.map((s) => s.id)).size).toBe(2);
    expect(u.state).toMatchObject({ phase: "shortBreak", status: "running" });
  });

  it("a phase that ended more than two minutes ago does not auto-start the next one", () => {
    expect(STALE_PHASE_END_MS).toBe(2 * M);
    const u = reconcileTimer(start(createIdleState(), CTX, T0, fast), fast, T0 + 4 * M + 30_000);
    expect(u.sessions).toHaveLength(1);
    expect(u.state).toMatchObject({ status: "idle", phase: "shortBreak" });
  });

  it("details apply only to focus starts, and a start without details keeps the last ones", () => {
    const brk = applyCommand(createIdleState("shortBreak"), "start", SETTINGS, T0, CTX).state;
    expect(brk.intent.taskId).toBeNull();
    expect(brk.sessionStartedAt).toBeNull();
    expect(applyCommand(createIdleState("focus", 0, CTX), "start", SETTINGS, T0).state.intent).toEqual(CTX);
  });
});

describe("sanitizeTimerState (SRS 9.2)", () => {
  it("accepts a state saved by an older version without the newer fields", () => {
    const old = { status: "running", phase: "focus", phaseDurationMs: 25 * M, endsAt: T0 + 5 * M, remainingMs: 0, completedFocusCount: 2 };
    const s = sanitizeTimerState(old);
    expect(s.status).toBe("running");
    expect(s.intent).toEqual({ title: null, subject: null, taskId: null });
    expect(s.sessionStartedAt).toBeNull();
    expect(reconcileTimer(s, SETTINGS, T0 + 6 * M).sessions).toHaveLength(0);
  });

  it("keeps valid fields and drops junk", () => {
    const run = start();
    expect(sanitizeTimerState(JSON.parse(JSON.stringify(run)))).toEqual(run);
    const s = sanitizeTimerState({ ...run, intent: { title: 5, subject: "x".repeat(500), taskId: "" }, sessionStartedAt: "now" });
    expect(s.intent.title).toBeNull();
    expect(s.intent.subject?.length).toBe(40);
    expect(s.intent.taskId).toBeNull();
    expect(s.sessionStartedAt).toBeNull();
  });

  it("corrupted data becomes an idle timer", () => {
    for (const bad of [null, "x", 5, [], { status: "exploding" }, { status: "running", phase: "focus" }]) {
      expect(sanitizeTimerState(bad).status).toBe("idle");
    }
  });
});
