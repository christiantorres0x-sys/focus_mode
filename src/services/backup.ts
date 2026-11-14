// Export and import of productivity data (FR-44, FR-45, NFR-12). Pure functions:
// no browser calls, so they are easy to test. Imported files are never trusted:
// they are fully checked here BEFORE anything is written to storage.

import type { BlockedWebsite } from "../types/blocker";
import type { StudySession } from "../types/session";
import type { UserSettings } from "../types/settings";
import type { StudyTask } from "../types/task";
import { dayKey } from "../utils/stats";
import { sanitizeSessions, sanitizeTasks } from "./records";
import { SCHEMA_VERSION, sanitizeBlocklist, sanitizeSettings } from "./storage";

export const BACKUP_APP = "focus-mode";
export const MAX_IMPORT_BYTES = 5_000_000;
const MAX_ITEMS = { sessions: 50_000, tasks: 5_000, blocklist: 1_000 } as const;

export interface BackupData {
  settings: UserSettings;
  blocklist: BlockedWebsite[];
  tasks: StudyTask[];
  sessions: StudySession[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export function buildBackup(data: BackupData, now: number): BackupFile {
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), data };
}

export function backupFileName(now: number, kind: "backup" | "sessions" | "tasks"): string {
  return `focus-mode-${kind}-${dayKey(now)}.${kind === "backup" ? "json" : "csv"}`;
}

// ---- CSV (FR-44) ----

// Quotes a value for CSV. Text that starts with = + - @ could be run as a formula
// when the file is opened in a spreadsheet, so it is prefixed with an apostrophe.
export function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: (string | number | boolean | null)[][]): string {
  // The byte order mark helps Excel read accented letters correctly.
  return "\uFEFF" + [header, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\r\n") + "\r\n";
}

const minutes = (ms: number) => Math.round((ms / 60_000) * 100) / 100;

export function sessionsToCsv(sessions: readonly StudySession[]): string {
  return toCsv(
    ["id", "date", "started_at", "ended_at", "status", "title", "subject", "task_id", "planned_minutes", "actual_minutes"],
    sessions.map((s) => [
      s.id,
      dayKey(s.endedAt ?? s.startedAt),
      new Date(s.startedAt).toISOString(),
      s.endedAt === null ? null : new Date(s.endedAt).toISOString(),
      s.status,
      s.title,
      s.subject,
      s.taskId,
      minutes(s.plannedMs),
      minutes(s.actualMs),
    ]),
  );
}

export function tasksToCsv(tasks: readonly StudyTask[]): string {
  return toCsv(
    ["id", "title", "subject", "estimated_minutes", "completed", "created_at", "completed_at"],
    tasks.map((t) => [
      t.id,
      t.title,
      t.subject,
      t.estimatedMinutes,
      t.completed,
      new Date(t.createdAt).toISOString(),
      t.completedAt === null ? null : new Date(t.completedAt).toISOString(),
    ]),
  );
}

// ---- Import (FR-45) ----

export interface ImportPreview {
  settings: UserSettings | null;
  blocklist: BlockedWebsite[] | null;
  tasks: StudyTask[] | null;
  sessions: StudySession[] | null;
  // Entries in the file that were invalid or duplicated and will be left out.
  skipped: { blocklist: number; tasks: number; sessions: number };
  exportedAt: string | null;
}

export type ImportResult = { ok: true; preview: ImportPreview } | { ok: false; error: string };

const fail = (error: string): ImportResult => ({ ok: false, error });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Checks one list section. Returns the valid entries and how many were left out,
// or an error message when the section as a whole is unusable.
function checkList<T>(
  name: keyof typeof MAX_ITEMS,
  label: string,
  raw: unknown,
  sanitize: (raw: unknown) => T[],
): { ok: true; items: T[]; skipped: number } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: `The "${label}" section is not a list.` };
  if (raw.length > MAX_ITEMS[name]) return { ok: false, error: `The "${label}" section is too large to import.` };
  const items = sanitize(raw);
  if (raw.length > 0 && items.length === 0) return { ok: false, error: `None of the ${label} in this file are valid.` };
  return { ok: true, items, skipped: raw.length - items.length };
}

export function parseBackup(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return fail("This file is too large to be a Focus Mode backup.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return fail("This file is not valid JSON. Choose a backup exported from Focus Mode.");
  }

  if (!isRecord(parsed) || parsed.app !== BACKUP_APP) return fail("This is not a Focus Mode backup file.");
  const version = parsed.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return fail("This backup has no valid version number.");
  }
  if (version > SCHEMA_VERSION) return fail("This backup was made by a newer version of Focus Mode and cannot be imported.");
  if (!isRecord(parsed.data)) return fail("This backup has no data section.");

  const data = parsed.data;
  const hasAny = ["settings", "blocklist", "tasks", "sessions"].some((key) => key in data);
  if (!hasAny) return fail("This backup does not contain any data to import.");

  const preview: ImportPreview = {
    settings: null,
    blocklist: null,
    tasks: null,
    sessions: null,
    skipped: { blocklist: 0, tasks: 0, sessions: 0 },
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
  };

  if ("settings" in data) {
    if (!isRecord(data.settings)) return fail('The "settings" section is not valid.');
    preview.settings = sanitizeSettings(data.settings);
  }
  if ("blocklist" in data) {
    const r = checkList("blocklist", "blocked websites", data.blocklist, sanitizeBlocklist);
    if (!r.ok) return fail(r.error);
    preview.blocklist = r.items;
    preview.skipped.blocklist = r.skipped;
  }
  if ("tasks" in data) {
    const r = checkList("tasks", "tasks", data.tasks, sanitizeTasks);
    if (!r.ok) return fail(r.error);
    preview.tasks = r.items;
    preview.skipped.tasks = r.skipped;
  }
  if ("sessions" in data) {
    const r = checkList("sessions", "sessions", data.sessions, sanitizeSessions);
    if (!r.ok) return fail(r.error);
    preview.sessions = r.items;
    preview.skipped.sessions = r.skipped;
  }
  return { ok: true, preview };
}
