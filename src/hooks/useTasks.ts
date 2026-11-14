import { useCallback, useEffect, useState } from "react";
import { getTasks, onTasksChanged } from "../services/storage";
import { addTask, deleteTask, setTaskCompleted, updateTask, type TaskInput, type TaskResult } from "../services/tasks";
import type { StudyTask } from "../types/task";

const SAVE_ERROR = "Could not save your tasks. Please try again.";

export interface UseTasksResult {
  ready: boolean;
  tasks: StudyTask[];
  error: string | null;
  add: (input: TaskInput) => Promise<TaskResult>;
  update: (id: string, input: TaskInput) => Promise<TaskResult>;
  setCompleted: (id: string, completed: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTasks()
      .then((saved) => active && setTasks(saved))
      .catch((e) => {
        console.error("[Focus Mode] could not load tasks", e);
        if (active) setError("Could not load your tasks. Try reloading the extension.");
      })
      .finally(() => active && setReady(true));
    const unsubscribe = onTasksChanged((saved) => active && setTasks(saved));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const add = useCallback(async (input: TaskInput): Promise<TaskResult> => {
    try {
      setError(null);
      const result = await addTask(input);
      if (result.ok) setTasks(result.tasks);
      return result;
    } catch (e) {
      console.error("[Focus Mode] could not add task", e);
      setError(SAVE_ERROR);
      return { ok: false, errors: {} };
    }
  }, []);

  const update = useCallback(async (id: string, input: TaskInput): Promise<TaskResult> => {
    try {
      setError(null);
      const result = await updateTask(id, input);
      if (result.ok) setTasks(result.tasks);
      return result;
    } catch (e) {
      console.error("[Focus Mode] could not update task", e);
      setError(SAVE_ERROR);
      return { ok: false, errors: {} };
    }
  }, []);

  const setCompleted = useCallback(async (id: string, completed: boolean) => {
    try {
      setError(null);
      setTasks(await setTaskCompleted(id, completed));
    } catch (e) {
      console.error("[Focus Mode] could not update task", e);
      setError(SAVE_ERROR);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      setError(null);
      setTasks(await deleteTask(id));
    } catch (e) {
      console.error("[Focus Mode] could not delete task", e);
      setError(SAVE_ERROR);
    }
  }, []);

  return { ready, tasks, error, add, update, setCompleted, remove };
}
