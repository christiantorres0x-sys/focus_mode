import { describe, expect, it } from "vitest";
import type { BlockedWebsite } from "../types/blocker";
import { DEFAULT_TIMER_STATE, type TimerState } from "../types/timer";
import { BLOCKED_PAGE_PATH, activeDomains, buildRules, isBlockingActive, sameRules } from "./blockingRules";

const st = (over: Partial<TimerState>): TimerState => ({ ...DEFAULT_TIMER_STATE, ...over });
const site = (domain: string, enabled = true): BlockedWebsite => ({ id: domain, domain, category: null, enabled });

describe("when blocking is on (FR-13, FR-14, BR-01)", () => {
  it("only while the timer is running in focus mode", () => {
    expect(isBlockingActive(st({ status: "running", phase: "focus" }))).toBe(true);
    expect(isBlockingActive(st({ status: "paused", phase: "focus" }))).toBe(false);
    expect(isBlockingActive(st({ status: "idle", phase: "focus" }))).toBe(false);
    expect(isBlockingActive(st({ status: "running", phase: "shortBreak" }))).toBe(false);
    expect(isBlockingActive(st({ status: "running", phase: "longBreak" }))).toBe(false);
  });
});

describe("which sites are active (FR-16, BR-04)", () => {
  const sites = [site("b.com"), site("a.com"), site("off.com", false), site("a.com")];
  const running = st({ status: "running", phase: "focus" });
  it("enabled sites only, sorted, no duplicates", () => {
    expect(activeDomains(sites, running)).toEqual(["a.com", "b.com"]);
  });
  it("nothing when blocking is off, and the saved list is not changed", () => {
    expect(activeDomains(sites, st({ status: "paused" }))).toEqual([]);
    expect(sites).toHaveLength(4);
  });
});

describe("rules (FR-15, FR-17, NFR-06)", () => {
  it("one redirect rule per domain, unique ids, top-level pages only", () => {
    const rules = buildRules(["a.com", "b.com"]);
    expect(rules.map((r) => r.id)).toEqual([1, 2]);
    expect(rules[0].condition).toEqual({ requestDomains: ["a.com"], resourceTypes: ["main_frame"] });
    expect(rules[0].action.redirect.extensionPath).toBe(`${BLOCKED_PAGE_PATH}?site=a.com`);
  });
  it("sameRules ignores order and detects any change", () => {
    const a = buildRules(["a.com", "b.com"]);
    expect(sameRules(a, [...a].reverse())).toBe(true);
    expect(sameRules(a, buildRules(["a.com"]))).toBe(false);
    expect(sameRules(a, buildRules(["a.com", "c.com"]))).toBe(false);
    expect(sameRules([], [])).toBe(true);
  });
});
