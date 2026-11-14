// Study task data model (SRS 6.4).

export interface StudyTask {
  id: string;
  title: string;
  subject: string | null;
  estimatedMinutes: number | null;
  completed: boolean;
  createdAt: number; // epoch ms
  completedAt: number | null; // epoch ms, only when completed
}

export const TASK_LIMITS = {
  title: 120,
  subject: 40,
  estimateMin: 1,
  estimateMax: 1440,
} as const;
