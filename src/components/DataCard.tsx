import { useId, useRef, useState } from "react";
import { Database, Download, FileUp, Trash2 } from "lucide-react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import type { ImportPreview } from "../services/backup";
import {
  applyImport,
  checkImportFile,
  exportBackupJson,
  exportSessionsCsv,
  exportTasksCsv,
  resetEverything,
} from "../services/dataActions";

type Notice = { text: string; error: boolean } | null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function previewLines(p: ImportPreview): string[] {
  const lines: string[] = [];
  if (p.sessions) lines.push(`${plural(p.sessions.length, "session")} (replaces your current sessions)`);
  if (p.tasks) lines.push(`${plural(p.tasks.length, "task")} (replaces your current tasks)`);
  if (p.blocklist) lines.push(`${plural(p.blocklist.length, "blocked website")} (replaces your current list)`);
  if (p.settings) lines.push("Your settings (replaces your current settings)");
  return lines;
}

export default function DataCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const confirmId = useId();
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const guard = async (action: () => Promise<string>, failed: string) => {
    setBusy(true);
    try {
      setNotice({ text: await action(), error: false });
    } catch (e) {
      console.error("[Focus Mode]", failed, e);
      setNotice({ text: failed, error: true });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    setPreview(null);
    setNotice(null);
    if (!file) return;
    const result = await checkImportFile(file);
    if (fileInput.current) fileInput.current.value = "";
    if (result.ok) setPreview(result.preview);
    else setNotice({ text: `${result.error} Nothing was changed.`, error: true });
  };

  const skipped = preview ? preview.skipped.sessions + preview.skipped.tasks + preview.skipped.blocklist : 0;

  return (
    <Card title="Your data" icon={Database} description="Everything stays on this device. Export a copy, restore one, or start over.">
      <div className="space-y-6">
        <section aria-labelledby="export-heading">
          <h3 id="export-heading" className="text-sm font-medium">Export</h3>
          <p className="mt-1 text-xs text-muted">
            The backup (JSON) holds everything and can be imported again. The CSV files open in a spreadsheet.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" icon={Download} disabled={busy} onClick={() => guard(async () => { await exportBackupJson(); return "Backup downloaded."; }, "Could not create the backup.")}>
              Backup (JSON)
            </Button>
            <Button variant="secondary" icon={Download} disabled={busy} onClick={() => guard(async () => `Sessions exported (${plural(await exportSessionsCsv(), "row")}).`, "Could not export sessions.")}>
              Sessions (CSV)
            </Button>
            <Button variant="secondary" icon={Download} disabled={busy} onClick={() => guard(async () => `Tasks exported (${plural(await exportTasksCsv(), "row")}).`, "Could not export tasks.")}>
              Tasks (CSV)
            </Button>
          </div>
        </section>

        <hr className="border-line" />

        <section aria-labelledby="import-heading">
          <h3 id="import-heading" className="text-sm font-medium">Import a backup</h3>
          <p className="mt-1 text-xs text-muted">
            Choose a JSON backup made by Focus Mode. The file is checked first and nothing changes until you confirm.
          </p>
          <input
            ref={fileInput}
            id="import-file"
            type="file"
            accept="application/json,.json"
            aria-label="Backup file to import (JSON)"
            className="hidden"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <Button variant="secondary" icon={FileUp} className="mt-3" disabled={busy} onClick={() => fileInput.current?.click()}>
            Choose backup file
          </Button>

          {preview && (
            <div role="group" aria-label="Confirm import" className="mt-3 rounded-xl border border-line bg-app p-4">
              <p className="text-sm font-medium">This file is valid. Importing will:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {previewLines(preview).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {skipped > 0 && (
                <p className="mt-2 text-xs text-muted">
                  {plural(skipped, "entry")} in the file were invalid or duplicated and will be left out.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() => {
                    const ready = preview;
                    setPreview(null);
                    void guard(async () => { await applyImport(ready); return "Backup imported."; }, "Could not import the backup. Your data was not changed.");
                  }}
                >
                  Replace my data
                </Button>
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>

        <hr className="border-line" />

        <section aria-labelledby="reset-heading">
          <h3 id="reset-heading" className="text-sm font-medium">Reset everything</h3>
          <p className="mt-1 text-xs text-muted">
            Deletes all sessions, tasks and settings, and restores the suggested blocklist. This cannot be undone, so export a backup first.
          </p>
          {!resetOpen ? (
            <Button variant="secondary" icon={Trash2} className="mt-3 !text-red-600 dark:!text-red-400" onClick={() => setResetOpen(true)}>
              Reset all data…
            </Button>
          ) : (
            <div role="group" aria-label="Confirm reset" className="mt-3 rounded-xl border border-red-300 p-4 dark:border-red-800">
              <label htmlFor={confirmId} className="text-sm">
                Type <strong>RESET</strong> to confirm.
              </label>
              <input
                id={confirmId}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                className="mt-2 block w-40 rounded-lg border border-line bg-app px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={busy || typed.trim() !== "RESET"}
                  className="!bg-red-600 !text-white hover:!bg-red-700"
                  onClick={() => {
                    setResetOpen(false);
                    setTyped("");
                    void guard(async () => { await resetEverything(); return "Everything was reset."; }, "Could not reset. Your data was not erased.");
                  }}
                >
                  Erase everything
                </Button>
                <Button variant="secondary" onClick={() => { setResetOpen(false); setTyped(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>

        {notice && (
          <p role={notice.error ? "alert" : "status"} className={`text-sm ${notice.error ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
            {notice.text}
          </p>
        )}
      </div>
    </Card>
  );
}
