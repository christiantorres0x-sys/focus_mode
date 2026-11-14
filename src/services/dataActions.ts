// Browser-side actions for export, import, reset and test alerts (FR-38, FR-44..46).
// The rules about WHAT is valid live in backup.ts; this file does the downloading,
// the reading and the storage writes.

import {
  MAX_IMPORT_BYTES,
  backupFileName,
  buildBackup,
  parseBackup,
  sessionsToCsv,
  tasksToCsv,
  type ImportPreview,
  type ImportResult,
} from "./backup";
import { getBlocklist, getSessions, getSettings, getTasks, replaceData, resetAllData } from "./storage";
import { sendTimerCommand } from "./timerClient";
import { playChime } from "../utils/chime";

function download(fileName: string, mime: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportBackupJson(): Promise<void> {
  const [settings, blocklist, tasks, sessions] = await Promise.all([getSettings(), getBlocklist(), getTasks(), getSessions()]);
  const now = Date.now();
  download(backupFileName(now, "backup"), "application/json", JSON.stringify(buildBackup({ settings, blocklist, tasks, sessions }, now), null, 2));
}

export async function exportSessionsCsv(): Promise<number> {
  const sessions = await getSessions();
  download(backupFileName(Date.now(), "sessions"), "text/csv", sessionsToCsv(sessions));
  return sessions.length;
}

export async function exportTasksCsv(): Promise<number> {
  const tasks = await getTasks();
  download(backupFileName(Date.now(), "tasks"), "text/csv", tasksToCsv(tasks));
  return tasks.length;
}

// Reads and checks a chosen file. Nothing is written to storage here.
export async function checkImportFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "This file is too large to be a Focus Mode backup." };
  try {
    return parseBackup(await file.text());
  } catch {
    return { ok: false, error: "The file could not be read." };
  }
}

// Writes a checked preview in one storage call. Throws if the browser cannot save.
export async function applyImport(preview: ImportPreview): Promise<void> {
  await replaceData({
    settings: preview.settings ?? undefined,
    blocklist: preview.blocklist ?? undefined,
    tasks: preview.tasks ?? undefined,
    sessions: preview.sessions ?? undefined,
  });
}

// Stops the timer first (which also switches blocking off), then erases everything.
// If the timer cannot be stopped this throws and NOTHING is erased.
export async function resetEverything(): Promise<void> {
  await sendTimerCommand("reset");
  await resetAllData();
  await sendTimerCommand("reconcile").catch(() => undefined); // refresh blocking status
}

// "granted" or "denied" as reported by the browser or operating system.
export async function notificationPermission(): Promise<"granted" | "denied"> {
  return new Promise((resolve) => {
    try {
      chrome.notifications.getPermissionLevel((level) => resolve(level === "granted" ? "granted" : "denied"));
    } catch {
      resolve("denied");
    }
  });
}

export async function sendTestNotification(): Promise<void> {
  await chrome.notifications.create("focusmode:test", {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "Focus Mode",
    message: "Notifications are working. You will see this when a focus or break phase ends.",
    priority: 1,
  });
}

export const testSound = playChime;
