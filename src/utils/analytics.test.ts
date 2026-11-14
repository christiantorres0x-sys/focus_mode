import { describe, expect, it } from "vitest";
import type { StudySession } from "../types/session";
import {
  NO_SUBJECT, changePercent, computeStreaks, dailySeries, filterHistory, lastDays, previousDays,
  sessionsInDays, subjectBreakdown, summarizePeriod,
} from "./analytics";

const M = 60_000;
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();
const ses = (end: number, mins: number, subject: string | null = null, status: StudySession["status"] = "completed"): StudySession => ({
  id: `s${end}-${mins}`, taskId: null, subject, title: null, startedAt: end - mins * M, endedAt: end, plannedMs: mins * M, actualMs: mins * M, status,
});
const now = at(2026, 11, 13, 15);
const days = lastDays(7, now);
const list = [ses(at(2026, 11, 13, 9), 30, "Math"), ses(at(2026, 11, 13, 11), 20, "Art", "interrupted"), ses(at(2026, 11, 12, 10), 60, "Math"), ses(at(2026, 11, 1, 10), 45)];

describe("ranges (FR-33)", () => {
  it("lastDays gives N local days ending today, oldest first", () => {
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-11-07");
    expect(days[6]).toBe("2026-11-13");
  });
  it("previousDays is the period right before", () => {
    const prev = previousDays(7, now);
    expect(prev).toHaveLength(7);
    expect(prev[6]).toBe("2026-11-06");
  });
  it("never repeats or skips a day across a daylight-saving change", () => {
    const span = lastDays(10, at(2026, 3, 12, 12));
    expect(new Set(span).size).toBe(10);
    expect(span[9]).toBe("2026-03-12");
    expect(span[0]).toBe("2026-03-03");
  });
});

describe("series, subjects and summary (FR-30, FR-31, FR-34)", () => {
  const inRange = sessionsInDays(list, days);
  const series = dailySeries(inRange, days);

  it("excludes sessions outside the range and fills empty days with zeros", () => {
    expect(inRange).toHaveLength(3);
    expect(series[6]).toMatchObject({ focusMs: 50 * M, completed: 1, interrupted: 1 });
    expect(series[5].focusMs).toBe(60 * M);
    expect(series[0].focusMs).toBe(0);
  });

  it("shares of focus time per subject, with a bucket for no subject", () => {
    const sub = subjectBreakdown(inRange);
    expect(sub[0].subject).toBe("Math");
    expect(Math.round(sub[0].share * 100)).toBe(82);
    expect(sub).toHaveLength(2);
    expect(subjectBreakdown([ses(at(2026, 11, 13), 10)])[0].subject).toBe(NO_SUBJECT);
  });

  it("period summary: best day, average and completion rate", () => {
    const p = summarizePeriod(inRange, series);
    expect(p.bestDay?.key).toBe("2026-11-12");
    expect(p.averageMs).toBeCloseTo((110 * M) / 7);
    expect(Math.round((p.completionRate ?? 0) * 100)).toBe(67);
  });

  it("an empty period has no best day and no rate", () => {
    const empty = summarizePeriod([], dailySeries([], days));
    expect(empty.bestDay).toBeNull();
    expect(empty.completionRate).toBeNull();
  });

  it("change versus the previous period", () => {
    expect(changePercent(110, 55)).toBe(100);
    expect(changePercent(50, 100)).toBe(-50);
    expect(changePercent(10, 0)).toBeNull();
  });
});

describe("streaks: a day counts when the daily goal is reached (FR-35)", () => {
  const g = (d: number, mins = 60) => ses(at(2026, 11, d, 10), mins);

  it("counts consecutive days ending today", () => {
    expect(computeStreaks([g(13), g(12), g(11), g(9)], 60, now)).toEqual({ current: 3, longest: 3, todayMet: true });
  });
  it("a streak survives until today ends", () => {
    expect(computeStreaks([g(12), g(11), g(10)], 60, now)).toMatchObject({ current: 3, todayMet: false });
  });
  it("a missed whole day resets the current streak but keeps the longest", () => {
    expect(computeStreaks([g(11), g(10)], 60, now)).toMatchObject({ current: 0, longest: 2 });
  });
  it("just under the goal does not count, and sessions on the same day add up", () => {
    expect(computeStreaks([g(13, 59)], 60, now).current).toBe(0);
    expect(computeStreaks([ses(at(2026, 11, 13, 9), 30), ses(at(2026, 11, 13, 11), 30)], 60, now).todayMet).toBe(true);
  });
  it("finds the longest run across gaps", () => {
    expect(computeStreaks([g(2), g(3), g(4), g(5), g(8), g(9)], 60, now).longest).toBe(4);
  });
  it("runs continue across a month boundary", () => {
    expect(computeStreaks([ses(at(2026, 2, 28), 60), ses(at(2026, 3, 1), 60)], 60, at(2026, 3, 1, 20)).current).toBe(2);
  });
});

describe("history filter (FR-32)", () => {
  it("filters by status and sorts newest first", () => {
    expect(filterHistory(list, "interrupted")).toHaveLength(1);
    expect(filterHistory(list, "all")[0].endedAt).toBe(at(2026, 11, 13, 11));
  });
});
