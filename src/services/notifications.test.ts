import { describe, expect, it } from "vitest";
import { DEFAULT_TIMER_STATE, type TimerState } from "../types/timer";
import { endedRecently, phaseEndAlert } from "./notifications";

const M = 60_000;
const T0 = Date.UTC(2026, 10, 13, 2, 0, 0);
const st = (over: Partial<TimerState>): TimerState => ({ ...DEFAULT_TIMER_STATE, ...over });

describe("endedRecently (FR-37)", () => {
  it("is true only for a running phase that just ended", () => {
    expect(endedRecently(st({ status: "running", endsAt: T0 }), T0 + 5000)).toBe(true);
    expect(endedRecently(st({ status: "running", endsAt: T0 }), T0 + 3 * M)).toBe(false);
    expect(endedRecently(st({ status: "running", endsAt: T0 + 9999 }), T0)).toBe(false);
    expect(endedRecently(st({ status: "paused", endsAt: null }), T0)).toBe(false);
    expect(endedRecently(st({ status: "idle" }), T0)).toBe(false);
  });
});

describe("phaseEndAlert", () => {
  const minutes = (s: TimerState) => (s.phase === "longBreak" ? 15 : 5);
  it("announces a focus session finishing, with the break length when it starts", () => {
    expect(phaseEndAlert(st({ phase: "shortBreak", status: "running" }), minutes)).toEqual({
      title: "Focus session complete",
      message: "Your short break has started (5 min).",
    });
    expect(phaseEndAlert(st({ phase: "longBreak", status: "idle" }), minutes).message).toBe("Time for a long break.");
  });
  it("announces a break ending", () => {
    expect(phaseEndAlert(st({ phase: "focus", status: "idle" }), minutes).title).toBe("Break is over");
    expect(phaseEndAlert(st({ phase: "focus", status: "running" }), () => 25).message).toBe("Your next focus session has started (25 min).");
  });
});
