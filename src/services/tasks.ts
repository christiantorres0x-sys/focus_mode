// Study task operations used by the UI (FR-25, FR-26). Input is validated before
// anything is saved. Every function saves through the storage service and
// returns the new list; they throw if the browser cannot save (SRS 9.3).

import { getTasks, saveTasks } from "./storage";
import { TASK_LIMITS, type StudyTask } from "../types/task";
import { cleanText } from "../utils/text";

// What the form gives us: plain text fields.
export interface TaskInput {
  title: string;
  subject: string;
  estimate: string; // minutes, may be empty
}

export type TaskErrors = Partial<Record<keyof TaskInput, string>>;

export interface TaskValues {
  title: string;
  subject: string | null;
  estimatedMinutes: number | null;
}

export type TaskValidation = { ok: true; value: TaskValues } | { ok: false; errors: TaskErrors };

export function validateTaskInput(input: TaskInput): TaskValidation {
  const errors: TaskErrors = {};

  const title = input.title.trim();
  if (title === "") errors.title = "Enter a task title.";
  else if (title.length > TASK_LIMITS.title) errors.title = `Titles can be up to ${TASK_LIMITS.title} characters.`;

  const subject = input.subject.trim();
  if (subject.length > TASK_LIMITS.subject) errors.subject = `Subjects can be up to ${TASK_LIMITS.subject} characters.`;

  let estimatedMinutes: number | null = null;
  const estimate = input.estimate.trim();
  if (estimate !== "") {
    const value = Number(estimate);
    if (!/^\d+$/.test(estimate) || value < TASK_LIMITS.estimateMin || value > TASK_LIMITS.estimateMax) {
      errors.estimate = `Enter whole minutes from ${TASK_LIMITS.estimateMin} to ${TASK_LIMITS.estimateMax}, or leave it empty.`;
    } else {
      estimatedMinutes = value;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, subject: cleanText(subject, TASK_LIMITS.subject), estimatedMinutes } };
}

export type TaskResult = { ok: true; tasks: StudyTask[] } | { ok: false; errors: TaskErrors };

export async function addTask(input: TaskInput): Promise<TaskResult> {
  const checked = validateTaskInput(input);
  if (!checked.ok) return checked;

  const task: StudyTask = {
    id: crypto.randomUUID(),
    ...checked.value,
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  };
  const tasks = [...(await getTasks()), task];
  await saveTasks(tasks);
  return { ok: true, tasks };
}

export async function updateTask(id: string, input: TaskInput): Promise<TaskResult> {
  const checked = validateTaskInput(input);
  if (!checked.ok) return checked;

  const tasks = (await getTasks()).map((task) => (task.id === id ? { ...task, ...checked.value } : task));
  await saveTasks(tasks);
  return { ok: true, tasks };
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<StudyTask[]> {
  const tasks = (await getTasks()).map((task) =>
    task.id === id ? { ...task, completed, completedAt: completed ? Date.now() : null } : task,
  );
  await saveTasks(tasks);
  return tasks;
}

export async function deleteTask(id: string): Promise<StudyTask[]> {
  const tasks = (await getTasks()).filter((task) => task.id !== id);
  await saveTasks(tasks);
  return tasks;
}
