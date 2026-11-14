// Integration tests: the real background worker code running against a mocked
// chrome.* (tests/chromeMock.ts). Covers SRS 10.1 and 10.2: normal use, restarts,
// suspension, late alarms, blocking state and recording.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE_ALARM, installChrome, settle, type Harness } from "../../tests/chromeMock";
import { DEFAULT_SETTINGS } from "../types/settings";

const M = 60_000;
let h: Harness;

async function boot(): Promise<void> {
  vi.resetModules();
  h.resetListeners();
  await import("./index");
  await settle();
}

const settings = (over: Record<string, unknown> = {}) => ({ ...DEFAULT_SETTINGS, focusDuration: 10, shortBreakDuration: 2, longBreakDuration: 5, longBreakInterval: 2, autoStartBreaks: true, autoStartFocus: false, ...over });
const site = (domain: string, enabled = true) => ({ id: domain, domain, category: null, enabled });
const sessions = () => (h.store.sessions ?? []) as { id: string; status: string; actualMs: number; taskId: string | null; title: string | null; startedAt: number }[];
const timer = () => h.store.timerState as { status: string; phase: string; endsAt: number | null };

beforeEach(() => {
  h = installChrome();
  h.store.settings = settings();
  h.store.blocklist = [site("youtube.com"), site("reddit.com"), site("off.com", false)];
});
afterEach(async () => {
  await settle(); // let the worker finish what it was doing before the fake browser goes away
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("timer through the worker (FR-01..FR-09)", () => {
  it("start arms one alarm at the end time; pause removes it; resume re-arms it", async () => {
    await boot();
    const started = await h.command("start");
    expect(started.ok).toBe(true);
    expect(h.alarms[PHASE_ALARM].when).toBe(h.now.value + 10 * M);
    h.now.value += 3 * M;
    await h.command("pause");
    expect(h.alarms[PHASE_ALARM]).toBeUndefined();
    h.now.value += 60 * M;
    await h.command("resume");
    expect(h.alarms[PHASE_ALARM].when).toBe(h.now.value + 7 * M);
  });

  it("a restarted worker re-arms the alarm and keeps a running timer running (FR-07, NFR-07)", async () => {
    await boot();
    await h.command("start");
    const endsAt = timer().endsAt;
    delete h.alarms[PHASE_ALARM]; // the browser was restarted: alarms are gone
    h.now.value += 2 * M;
    await boot();
    expect(timer().status).toBe("running");
    expect(timer().endsAt).toBe(endsAt);
    expect(h.alarms[PHASE_ALARM].when).toBe(endsAt);
  });

  it("a paused timer stays paused across a restart", async () => {
    await boot();
    await h.command("start");
    h.now.value += 4 * M;
    await h.command("pause");
    h.now.value += 500 * M;
    await boot();
    expect(timer().status).toBe("paused");
    expect(h.alarms[PHASE_ALARM]).toBeUndefined();
  });

  it("an alarm that fires late still completes the phase from stored timestamps (SRS 10.2)", async () => {
    await boot();
    await h.command("start");
    const endsAt = timer().endsAt ?? 0;
    h.now.value = endsAt + 45_000;
    await h.fireAlarm();
    expect(timer().phase).toBe("shortBreak");
    expect(timer().endsAt).toBe(endsAt + 2 * M);
    expect(sessions()).toHaveLength(1);
  });

  it("several commands sent at once are applied in order without losing any", async () => {
    await boot();
    const results = await Promise.all([h.command("start"), h.command("pause"), h.command("resume"), h.command("pause")]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(timer().status).toBe("paused");
  });

  it("ignores messages from other extensions and malformed messages", async () => {
    await boot();
    expect(await h.send({ type: "timer", action: "start" }, "someone-else")).toBe("IGNORED");
    expect(await h.send({ type: "timer", action: "explode" })).toBe("IGNORED");
    expect(await h.send("hello")).toBe("IGNORED");
    expect(h.store.timerState === undefined || timer().status === "idle").toBe(true);
  });

  it("corrupted saved timer data is repaired instead of crashing", async () => {
    h.store.timerState = { status: "running", phase: 42, endsAt: "soon" };
    await boot();
    const r = await h.command("reconcile");
    expect(r.ok).toBe(true);
    expect(r.state.status).toBe("idle");
  });
});

describe("blocking state (FR-13..FR-18, NFR-06)", () => {
  const domains = () => h.rules.flatMap((r) => r.condition.requestDomains ?? []).sort();

  it("rules exist only while a focus phase is running", async () => {
    await boot();
    expect(h.rules).toHaveLength(0);
    await h.command("start");
    expect(domains()).toEqual(["reddit.com", "youtube.com"]);
    await h.command("pause");
    expect(h.rules).toHaveLength(0);
    await h.command("resume");
    expect(domains()).toHaveLength(2);
    h.now.value = (timer().endsAt ?? 0) + 1000;
    await h.fireAlarm(); // break starts
    expect(timer().phase).toBe("shortBreak");
    expect(h.rules).toHaveLength(0);
  });

  it("stopping or skipping focus removes the rules", async () => {
    await boot();
    await h.command("start");
    await h.command("reset");
    expect(h.rules).toHaveLength(0);
    await h.command("start");
    await h.command("skip");
    expect(h.rules).toHaveLength(0);
  });

  it("restores blocking after a restart during focus, and clears stale rules after a restart in a break", async () => {
    await boot();
    await h.command("start");
    h.rules.splice(0);
    await boot();
    expect(domains()).toHaveLength(2);
    await h.command("skip");
    h.rules.splice(0, h.rules.length, { id: 9, condition: { requestDomains: ["stale.com"] }, action: {} });
    await boot();
    expect(h.rules).toHaveLength(0);
  });

  it("changing the blocklist during focus updates the rules; the saved list is untouched (BR-04)", async () => {
    await boot();
    await h.command("start");
    const before = h.counts.updateRules;
    await (chrome as unknown as { storage: { local: { set: (o: unknown) => Promise<void> } } }).storage.local.set({ blocklist: [site("youtube.com"), site("twitch.tv")] });
    await settle();
    expect(domains()).toEqual(["twitch.tv", "youtube.com"]);
    expect(h.counts.updateRules).toBeGreaterThan(before);
    await h.command("pause");
    expect((h.store.blocklist as unknown[]).length).toBe(2);
  });

  it("does not call the browser when the rules have not changed (NFR-06)", async () => {
    await boot();
    await h.command("start");
    const calls = h.counts.updateRules;
    await h.command("reconcile");
    await h.command("reconcile");
    expect(h.counts.updateRules).toBe(calls);
  });

  it("a rule failure never stops the timer, reports an error, and heals on the next sync (SRS 9.2)", async () => {
    await boot();
    h.fail.rules = true;
    const r = await h.command("start");
    expect(r.ok).toBe(true);
    expect(timer().status).toBe("running");
    expect((h.store.blockingStatus as { error: string | null }).error).toBeTruthy();
    h.fail.rules = false;
    await h.command("reconcile");
    expect((h.store.blockingStatus as { error: string | null; active: boolean }).error).toBeNull();
    expect(domains()).toHaveLength(2);
  });

  it("reports when the browser withholds site access", async () => {
    h.hostAccess.value = false;
    await boot();
    await h.command("start");
    expect(h.store.blockingStatus).toMatchObject({ active: false, hostAccess: false });
  });
});

describe("sessions recorded by the worker (FR-19..FR-24)", () => {
  it("resolves the task details from the stored task and ignores unknown task ids", async () => {
    h.store.tasks = [{ id: "t1", title: "Essay", subject: "English", estimatedMinutes: 30, completed: false, createdAt: 1, completedAt: null }];
    await boot();
    const a = await h.command("start", { title: null, subject: null, taskId: "t1" });
    expect(a.state.intent).toEqual({ taskId: "t1", title: "Essay", subject: "English" });
    h.now.value += 5 * M;
    await h.command("reset");
    expect(sessions()).toHaveLength(1);
    expect(sessions()[0]).toMatchObject({ status: "interrupted", actualMs: 5 * M, taskId: "t1" });

    const b = await h.command("start", { title: "  Free study  ", subject: "Math", taskId: "ghost" });
    expect(b.state.intent).toEqual({ taskId: null, title: "Free study", subject: "Math" });
  });

  it("stopping under one minute records nothing", async () => {
    await boot();
    await h.command("start");
    h.now.value += 30_000;
    await h.command("reset");
    expect(sessions()).toHaveLength(0);
  });

  it("rejects malformed details", async () => {
    await boot();
    expect(await h.send({ type: "timer", action: "start", context: "nope" })).toBe("IGNORED");
    expect(await h.send({ type: "timer", action: "start", context: { title: 5, subject: null, taskId: null } })).toBe("IGNORED");
  });

  it("a finished session is saved once however often the alarm and reconcile run (idempotent)", async () => {
    await boot();
    await h.command("start", { title: "Final", subject: "Art", taskId: null });
    h.now.value = (timer().endsAt ?? 0) + 2000;
    await h.fireAlarm();
    await h.fireAlarm();
    await h.command("reconcile");
    await boot(); // and a restart
    const done = sessions().filter((s) => s.title === "Final");
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ status: "completed", actualMs: 10 * M });
  });
});

describe("notifications and sound (FR-37..FR-40)", () => {
  beforeEach(() => {
    h.store.settings = settings({ notificationsEnabled: true, soundEnabled: false });
  });

  it("announces a focus ending once, with no sound when sound is off", async () => {
    await boot();
    await h.command("start");
    h.now.value += 10 * M + 3000;
    await h.fireAlarm();
    await settle();
    expect(h.notifications).toHaveLength(1);
    expect(h.notifications[0]).toMatchObject({ title: "Focus session complete", type: "basic" });
    expect(h.notifications[0].message).toMatch(/short break has started \(2 min\)/);
    expect(h.chimes).toHaveLength(0);
    await h.fireAlarm();
    await h.command("reconcile");
    expect(h.notifications).toHaveLength(1);
  });

  it("announces a break ending", async () => {
    await boot();
    await h.command("start");
    h.now.value += 10 * M + 1000;
    await h.fireAlarm();
    h.now.value += 2 * M + 1000;
    await h.fireAlarm();
    await settle();
    expect(h.notifications.at(-1)?.title).toBe("Break is over");
  });

  it("sound only: plays the chime through the offscreen page", async () => {
    h.store.settings = settings({ notificationsEnabled: false, soundEnabled: true });
    await boot();
    await h.command("start");
    h.now.value += 10 * M + 1000;
    await h.fireAlarm();
    await settle();
    expect(h.notifications).toHaveLength(0);
    expect(h.chimes).toEqual([{ type: "focusmode:play-chime" }]);
  });

  it("alert failures never stop the timer or lose the session (FR-40)", async () => {
    h.store.settings = settings({ notificationsEnabled: true, soundEnabled: true });
    h.fail.notify = true;
    h.fail.offscreen = true;
    await boot();
    await h.command("start");
    const startedAt = h.now.value;
    h.now.value += 10 * M + 500;
    await h.fireAlarm();
    await settle();
    expect(timer().phase).toBe("shortBreak");
    expect(sessions().filter((s) => s.startedAt === startedAt)).toHaveLength(1);
  });

  it("a phase that ended long ago is caught up silently", async () => {
    await boot();
    await h.command("start");
    h.now.value += 10 * M + 5 * M;
    await h.fireAlarm();
    await settle();
    expect(h.notifications).toHaveLength(0);
  });

  it("pause, reset and skip never announce", async () => {
    await boot();
    await h.command("start");
    h.now.value += 4 * M;
    await h.command("pause");
    await h.command("reset");
    await h.command("start");
    await h.command("skip");
    expect(h.notifications).toHaveLength(0);
  });
});
