// Study session data model (SRS 6.5) and the "what am I working on" context.

export type SessionStatus = "completed" | "interrupted";

// Optional details the user picks before a focus session (FR-20).
export interface FocusContext {
  title: string | null;
  subject: string | null;
  taskId: string | null;
}

export const EMPTY_FOCUS_CONTEXT: FocusContext = { title: null, subject: null, taskId: null };

// One finished focus session. A session is written when it ENDS, so there are
// only two statuses (FR-22). Durations are in milliseconds.
export interface StudySession {
  id: string;
  taskId: string | null;
  subject: string | null;
  title: string | null;
  startedAt: number; // epoch ms
  endedAt: number | null; // epoch ms (null only if unknown)
  plannedMs: number;
  actualMs: number; // focus time actually spent; paused time is NOT included
  status: SessionStatus;
}

// A stopped or skipped session shorter than this is not recorded at all, so an
// accidental click on Start does not add noise to the history.
export const MIN_RECORDED_MS = 60_000;

export const TEXT_LIMITS = { title: 120, subject: 40 } as const;
