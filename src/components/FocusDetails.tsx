import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useSessions } from "../hooks/useSessions";
import { useTasks } from "../hooks/useTasks";
import { TEXT_LIMITS, type FocusContext } from "../types/session";
import { collectSubjects } from "../utils/stats";

interface FocusDetailsProps {
  value: FocusContext;
  onChange: (value: FocusContext) => void;
  defaultOpen?: boolean;
  compact?: boolean; // popup: hides the title field (the task title is used)
}

const FIELD =
  "mt-1 w-full rounded-lg border border-line bg-app px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";

// Optional details for the next focus session: a title, a task and a subject (FR-20).
// Collapsed by default in the small popup so the timer stays the focus.
export default function FocusDetails({ value, onChange, defaultOpen = false, compact = false }: FocusDetailsProps) {
  const { ready, tasks } = useTasks();
  const { sessions } = useSessions();
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  const panelId = useId();

  const openTasks = tasks.filter((task) => !task.completed);
  const selected = openTasks.find((task) => task.id === value.taskId);
  const subjects = collectSubjects(tasks, sessions);

  // If the chosen task was completed or deleted meanwhile, drop the choice.
  useEffect(() => {
    if (ready && value.taskId !== null && !selected) onChange({ ...value, taskId: null });
  }, [ready, value, selected, onChange]);

  const summary = [value.title ?? selected?.title, value.subject].filter(Boolean).join(" · ");

  return (
    <div className={`${compact ? "mt-2" : "mt-4"} text-left`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-xs font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
      >
        <span className="min-w-0 truncate">
          Session details (optional){summary && <span className="font-normal"> · {summary}</span>}
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id={panelId} className="mt-2 space-y-2">
          {!compact && <label className="block text-xs font-medium">
            Title
            <input
              type="text"
              value={value.title ?? ""}
              maxLength={TEXT_LIMITS.title}
              placeholder="What will you work on?"
              onChange={(event) => onChange({ ...value, title: event.target.value || null })}
              className={FIELD}
            />
          </label>}
          <label className="block text-xs font-medium">
            Task
            <select
              value={value.taskId ?? ""}
              onChange={(event) => {
                const task = openTasks.find((item) => item.id === event.target.value);
                onChange({ ...value, taskId: task ? task.id : null, subject: task?.subject ?? value.subject });
              }}
              className={FIELD}
            >
              <option value="">No task</option>
              {openTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Subject
            <input
              type="text"
              list={listId}
              value={value.subject ?? ""}
              maxLength={TEXT_LIMITS.subject}
              placeholder="For example Math"
              onChange={(event) => onChange({ ...value, subject: event.target.value || null })}
              className={FIELD}
            />
            <datalist id={listId}>
              {subjects.map((subject) => (
                <option key={subject} value={subject} />
              ))}
            </datalist>
          </label>
        </div>
      )}
    </div>
  );
}
