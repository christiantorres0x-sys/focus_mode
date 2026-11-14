import { useNow } from "../hooks/useNow";
import { useSessions } from "../hooks/useSessions";
import { useSettings } from "../hooks/useSettings";
import { dayKey, goalPercent, sessionsOnDay, summarizeSessions } from "../utils/stats";
import { formatDuration } from "../utils/time";

// Today's focus time against the daily goal (FR-28, FR-29). It is calculated from
// the recorded sessions, so it moves when a session ends.
export default function DailyGoalMeter({ compact = false }: { compact?: boolean }) {
  const { ready, sessions } = useSessions();
  const { settings } = useSettings();
  const now = useNow();
  if (!ready) return <div className={compact ? "h-9" : "h-14"} aria-busy="true" />;

  const focusMs = summarizeSessions(sessionsOnDay(sessions, dayKey(now))).focusMs;
  const percent = goalPercent(focusMs, settings.dailyGoalMinutes);
  const reached = percent >= 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={compact ? "text-xs text-muted" : "font-medium"}>Today&apos;s goal</span>
        <span className={compact ? "text-xs font-medium" : "text-muted"}>
          {formatDuration(focusMs)} of {formatDuration(settings.dailyGoalMinutes * 60_000)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Daily goal progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% of your daily goal`}
        className={`mt-1.5 w-full overflow-hidden rounded-full bg-line ${compact ? "h-1.5" : "h-2.5"}`}
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      {!compact && (
        <p className="mt-1.5 text-xs text-muted">
          {reached ? "Daily goal reached. Nice work." : `${percent}% of your goal. Progress updates when a session ends.`}
        </p>
      )}
    </div>
  );
}
