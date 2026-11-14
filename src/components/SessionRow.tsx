import { CheckCircle2, XCircle } from "lucide-react";
import type { StudySession } from "../types/session";
import { formatDuration } from "../utils/time";

// One line of session history: what, when, how long, and whether it was completed.
export default function SessionRow({ session, showDate = false }: { session: StudySession; showDate?: boolean }) {
  const completed = session.status === "completed";
  const ended = new Date(session.endedAt ?? session.startedAt);
  const time = ended.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const when = showDate ? `${ended.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}` : time;
  const length = completed
    ? formatDuration(session.actualMs)
    : `${formatDuration(session.actualMs)} of ${formatDuration(session.plannedMs)}`;

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          completed ? "bg-brand-soft text-brand" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        }`}
      >
        {completed ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{session.title ?? "Focus session"}</p>
        <p className="truncate text-xs text-muted">
          {[session.subject, `${when}`, length].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          completed ? "bg-brand-soft text-brand" : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        }`}
      >
        {completed ? "Completed" : "Interrupted"}
      </span>
    </li>
  );
}
