import { Target, Timer } from "lucide-react";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import TimerPanel from "../../components/TimerPanel";
import DailyGoalMeter from "../../components/DailyGoalMeter";
import SessionRow from "../../components/SessionRow";
import { useNow } from "../../hooks/useNow";
import { useSessions } from "../../hooks/useSessions";
import { dayKey, sessionsOnDay, summarizeSessions } from "../../utils/stats";
import { formatDuration } from "../../utils/time";

export default function OverviewPage() {
  const { ready, sessions } = useSessions();
  const now = useNow();
  const today = sessionsOnDay(sessions, dayKey(now));
  const summary = summarizeSessions(today);
  const newestFirst = [...today].reverse();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <Card title="Pomodoro timer" icon={Timer} className="mx-auto max-w-md">
        <TimerPanel detailsDefaultOpen />
      </Card>

      <Card title="Today" icon={Target} description="Counted by the time each session ended.">
        <DailyGoalMeter />

        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-app p-3">
            <dd className="text-lg font-semibold tabular-nums">{formatDuration(summary.focusMs)}</dd>
            <dt className="text-xs text-muted">Focus time</dt>
          </div>
          <div className="rounded-xl bg-app p-3">
            <dd className="text-lg font-semibold tabular-nums">{summary.completed}</dd>
            <dt className="text-xs text-muted">Completed</dt>
          </div>
          <div className="rounded-xl bg-app p-3">
            <dd className="text-lg font-semibold tabular-nums">{summary.interrupted}</dd>
            <dt className="text-xs text-muted">Interrupted</dt>
          </div>
        </dl>

        {ready && today.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No focus sessions today"
            description="Start a focus session. It appears here when it ends, or when you stop it after at least a minute."
          />
        ) : (
          <ul className="mt-3 divide-y divide-line" aria-label="Today's sessions">
            {newestFirst.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
