import { Timer } from "lucide-react";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import TimerPanel from "../../components/TimerPanel";
import { useSettings } from "../../hooks/useSettings";

export default function OverviewPage() {
  const { settings } = useSettings();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <Card title="Pomodoro timer" icon={Timer} className="mx-auto max-w-md">
        <TimerPanel />
      </Card>

      <Card title="Today" description={`Your daily goal is ${settings.dailyGoalMinutes} minutes of focus.`}>
        <EmptyState
          icon={Timer}
          title="No focus sessions yet"
          description="Once you complete focus sessions, your focus time, goal progress and session history will appear here. Sessions are recorded starting in Phase 5."
        />
      </Card>
    </div>
  );
}
