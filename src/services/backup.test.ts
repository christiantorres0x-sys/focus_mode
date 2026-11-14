import { describe, expect, it } from "vitest";
import type { BlockedWebsite } from "../types/blocker";
import type { StudySession } from "../types/session";
import { DEFAULT_SETTINGS } from "../types/settings";
import type { StudyTask } from "../types/task";
import {
  MAX_IMPORT_BYTES, backupFileName, buildBackup, csvCell, parseBackup, sessionsToCsv, tasksToCsv, type BackupData,
} from "./backup";

const M = 60_000;
const T0 = Date.UTC(2026, 10, 13, 2, 0, 0);
const session = (i: number, over: Partial<StudySession> = {}): StudySession => ({
  id: `session-${i}`, taskId: null, subject: "Math", title: "Algebra", startedAt: T0 + i * 1e6, endedAt: T0 + i * 1e6 + 25 * M,
  plannedMs: 25 * M, actualMs: 25 * M, status: "completed", ...over,
});
const task: StudyTask = { id: "t1", title: "Essay", subject: "English", estimatedMinutes: 30, completed: false, createdAt: T0, completedAt: null };
const site: BlockedWebsite = { id: "a", domain: "youtube.com", category: "Video", enabled: true };
const data: BackupData = { settings: { ...DEFAULT_SETTINGS, dailyGoalMinutes: 90 }, blocklist: [site], tasks: [task], sessions: [session(1), session(2)] };
const file = buildBackup(data, T0);
const text = JSON.stringify(file);

function rejected(input: string, fragment: string): void {
  const r = parseBackup(input);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toContain(fragment);
}
function accepted(input: string) {
  const r = parseBackup(input);
  if (!r.ok) throw new Error(r.error);
  return r.preview;
}

describe("export then import (FR-44, FR-45)", () => {
  it("round-trips every section", () => {
    const p = accepted(text);
    expect(p.sessions).toEqual(data.sessions);
    expect(p.tasks).toEqual(data.tasks);
    expect(p.blocklist?.[0].domain).toBe("youtube.com");
    expect(p.settings?.dailyGoalMinutes).toBe(90);
  });
  it("names files by date", () => {
    expect(backupFileName(T0, "backup")).toMatch(/^focus-mode-backup-2026-11-1[23]\.json$/);
    expect(backupFileName(T0, "sessions")).toMatch(/\.csv$/);
  });
  it("accepts a file that starts with a byte order mark", () => {
    expect(parseBackup("﻿" + text).ok).toBe(true);
  });
});

describe("rejecting bad files (NFR-12)", () => {
  it("not JSON, wrong app, wrong shape", () => {
    rejected("not json{", "not valid JSON");
    rejected("[]", "not a Focus Mode");
    rejected(JSON.stringify({ app: "other", schemaVersion: 1, data: {} }), "not a Focus Mode");
  });
  it("bad or newer versions", () => {
    rejected(JSON.stringify({ ...file, schemaVersion: 99 }), "newer version");
    rejected(JSON.stringify({ ...file, schemaVersion: "1" }), "version number");
    rejected(JSON.stringify({ ...file, schemaVersion: 0 }), "version number");
  });
  it("missing, empty or mistyped data", () => {
    rejected(JSON.stringify({ ...file, data: null }), "no data section");
    rejected(JSON.stringify({ ...file, data: {} }), "any data");
    rejected(JSON.stringify({ ...file, data: { sessions: "x" } }), "not a list");
    rejected(JSON.stringify({ ...file, data: { settings: [] } }), "settings");
    rejected(JSON.stringify({ ...file, data: { sessions: [{ foo: 1 }, { bar: 2 }] } }), "None of the sessions");
  });
  it("oversized files", () => {
    rejected("x".repeat(MAX_IMPORT_BYTES + 1), "too large");
  });
});

describe("partly valid and hostile content", () => {
  it("skips and counts invalid or duplicate entries; missing sections stay untouched", () => {
    const p = accepted(JSON.stringify({ ...file, data: { sessions: [session(1), { junk: true }, session(1), session(2, { actualMs: -5 })] } }));
    expect(p.sessions).toHaveLength(1);
    expect(p.skipped.sessions).toBe(3);
    expect(p.settings).toBeNull();
    expect(p.tasks).toBeNull();
  });
  it("drops dangerous domains and repairs wrong types; markup stays inert text", () => {
    const p = accepted(JSON.stringify({ ...file, data: {
      blocklist: [{ domain: "javascript:alert(1)" }, { domain: "http://localhost" }, { domain: "Example.COM/path" }],
      tasks: [{ id: "x", title: "<img src=x onerror=alert(1)>", completed: "yes" }],
    } }));
    expect(p.blocklist?.map((s) => s.domain)).toEqual(["example.com"]);
    expect(p.skipped.blocklist).toBe(2);
    expect(p.tasks?.[0].completed).toBe(false);
    expect(p.tasks?.[0].title).toContain("<img");
  });
  it("invalid setting values fall back to defaults and valid ones are kept", () => {
    const p = accepted(JSON.stringify({ ...file, data: { settings: { focusDuration: 9999, theme: "neon", notificationsEnabled: "yes", dailyGoalMinutes: 45 } } }));
    expect(p.settings).toMatchObject({ focusDuration: DEFAULT_SETTINGS.focusDuration, theme: DEFAULT_SETTINGS.theme, dailyGoalMinutes: 45 });
  });
  it("a prototype pollution attempt has no effect", () => {
    const evil = text.replace('"data":{', '"data":{"__proto__":{"polluted":1},');
    expect(parseBackup(evil).ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("rejects lists that are absurdly large", () => {
    const many = Array.from({ length: 5_001 }, (_, i) => ({ id: `t${i}`, title: "x", completed: false, createdAt: 1 }));
    rejected(JSON.stringify({ ...file, data: { tasks: many } }), "too large");
  });
});

describe("CSV export (FR-44)", () => {
  it("quotes values and neutralises spreadsheet formulas", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell(null)).toBe("");
    expect(csvCell(25)).toBe("25");
  });
  it("sessions CSV has a header, one row per session and minutes", () => {
    const csv = sessionsToCsv([session(1, { title: '=HYPERLINK("x")', subject: "Math, Adv" }), session(2, { endedAt: null, status: "interrupted", actualMs: 90_000 })]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^id,date,started_at/);
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[1]).toContain('"Math, Adv"');
    expect(lines[2]).toContain(",1.5");
  });
  it("tasks CSV", () => {
    const lines = tasksToCsv([task]).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(",30,false,");
  });
});
