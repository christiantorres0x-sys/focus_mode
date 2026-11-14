import { useState, type FormEvent } from "react";
import { Check, ListChecks, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import DailyGoalMeter from "../../components/DailyGoalMeter";
import { useSessions } from "../../hooks/useSessions";
import { useTasks } from "../../hooks/useTasks";
import type { TaskErrors, TaskInput } from "../../services/tasks";
import { TASK_LIMITS, type StudyTask } from "../../types/task";
import { collectSubjects, focusMsByTask } from "../../utils/stats";

const EMPTY: TaskInput = { title: "", subject: "", estimate: "" };
const FIELD =
  "mt-1 w-full rounded-lg border border-line bg-app px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand aria-[invalid=true]:border-red-500";

interface TaskFormProps {
  initial: TaskInput;
  idPrefix: string;
  submitLabel: string;
  subjects: string[];
  onSubmit: (input: TaskInput) => Promise<TaskErrors | null>;
  onCancel?: () => void;
}

function TaskForm({ initial, idPrefix, submitLabel, subjects, onSubmit, onCancel }: TaskFormProps) {
  const [input, setInput] = useState<TaskInput>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await onSubmit(input);
    if (result) setErrors(result);
    else {
      setErrors({});
      setInput(EMPTY);
    }
  };
  const set = (key: keyof TaskInput) => (event: { target: { value: string } }) =>
    setInput((current) => ({ ...current, [key]: event.target.value }));
  const err = (key: keyof TaskInput) =>
    errors[key] ? (
      <span id={`${idPrefix}-${key}-error`} role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
        {errors[key]}
      </span>
    ) : null;
  const aria = (key: keyof TaskInput) => ({
    "aria-invalid": errors[key] !== undefined,
    "aria-describedby": errors[key] ? `${idPrefix}-${key}-error` : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-[2fr_1fr_8rem_auto] sm:items-start">
      <label className="block text-xs font-medium">
        Title
        <input type="text" value={input.title} onChange={set("title")} maxLength={TASK_LIMITS.title + 20} placeholder="For example Read chapter 4" className={FIELD} {...aria("title")} />
        {err("title")}
      </label>
      <label className="block text-xs font-medium">
        Subject (optional)
        <input type="text" list={`${idPrefix}-subjects`} value={input.subject} onChange={set("subject")} placeholder="Math" className={FIELD} {...aria("subject")} />
        <datalist id={`${idPrefix}-subjects`}>
          {subjects.map((subject) => (
            <option key={subject} value={subject} />
          ))}
        </datalist>
        {err("subject")}
      </label>
      <label className="block text-xs font-medium">
        Estimate (min)
        <input type="text" inputMode="numeric" value={input.estimate} onChange={set("estimate")} placeholder="45" className={FIELD} {...aria("estimate")} />
        {err("estimate")}
      </label>
      <div className="flex gap-2 sm:mt-5">
        <Button type="submit" icon={initial === EMPTY ? Plus : Check}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" icon={X} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

const toInput = (task: StudyTask): TaskInput => ({
  title: task.title,
  subject: task.subject ?? "",
  estimate: task.estimatedMinutes === null ? "" : String(task.estimatedMinutes),
});

export default function TasksPage() {
  const { ready, tasks, error, add, update, setCompleted, remove } = useTasks();
  const { sessions } = useSessions();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const focusByTask = focusMsByTask(sessions);
  const subjects = collectSubjects(tasks, sessions);
  const todo = tasks.filter((task) => !task.completed);
  const done = tasks.filter((task) => task.completed).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const row = (task: StudyTask) => {
    if (editing === task.id) {
      return (
        <li key={task.id} className="py-3">
          <TaskForm
            initial={toInput(task)}
            idPrefix={`edit-${task.id}`}
            submitLabel="Save"
            subjects={subjects}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              const result = await update(task.id, input);
              if (result.ok) {
                setEditing(null);
                return null;
              }
              return result.errors;
            }}
          />
        </li>
      );
    }
    const spent = Math.round((focusByTask.get(task.id) ?? 0) / 60_000);
    const progress =
      task.estimatedMinutes !== null ? `Focused ${spent} of ${task.estimatedMinutes} min` : spent > 0 ? `Focused ${spent} min` : null;
    return (
      <li key={task.id} className="flex items-center gap-3 py-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={(event) => setCompleted(task.id, event.target.checked)}
          aria-label={`Mark "${task.title}" as ${task.completed ? "not done" : "done"}`}
          className="h-5 w-5 shrink-0 accent-[var(--color-brand)]"
        />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${task.completed ? "text-muted line-through" : ""}`}>{task.title}</p>
          <p className="truncate text-xs text-muted">{[task.subject, progress].filter(Boolean).join(" · ") || "No subject or estimate"}</p>
        </div>
        {confirming === task.id ? (
          <div className="flex items-center gap-2" role="group" aria-label={`Delete "${task.title}"?`}>
            <span className="text-xs text-muted">Delete?</span>
            <Button variant="secondary" onClick={() => { void remove(task.id); setConfirming(null); }} className="!px-3 !py-1.5 !text-red-600">
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)} className="!px-3 !py-1.5">
              Keep
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 gap-1">
            {task.completed ? (
              <Button variant="ghost" icon={Undo2} aria-label={`Reopen "${task.title}"`} title="Reopen" onClick={() => setCompleted(task.id, false)} className="!px-2.5" />
            ) : (
              <Button variant="ghost" icon={Pencil} aria-label={`Edit "${task.title}"`} title="Edit" onClick={() => setEditing(task.id)} className="!px-2.5" />
            )}
            <Button variant="ghost" icon={Trash2} aria-label={`Delete "${task.title}"`} title="Delete" onClick={() => setConfirming(task.id)} className="!px-2.5" />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tasks</h1>

      <Card title="Daily goal">
        <DailyGoalMeter />
      </Card>

      <Card title="Add a task" icon={Plus}>
        <TaskForm
          initial={EMPTY}
          idPrefix="new"
          submitLabel="Add task"
          subjects={subjects}
          onSubmit={async (input) => {
            const result = await add(input);
            return result.ok ? null : result.errors;
          }}
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </Card>

      <Card title="To do" icon={ListChecks}>
        {ready && todo.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={tasks.length === 0 ? "No study tasks yet" : "Everything is done"}
            description={tasks.length === 0 ? "Add a task above. You can pick it when you start a focus session, and its focus time is tracked." : "Add another task above when you are ready."}
          />
        ) : (
          <ul className="divide-y divide-line" aria-label="Tasks to do">{todo.map(row)}</ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card title={`Done (${done.length})`}>
          <ul className="divide-y divide-line" aria-label="Completed tasks">{done.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}
