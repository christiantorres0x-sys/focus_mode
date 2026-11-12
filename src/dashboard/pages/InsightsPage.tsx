import { BarChart3 } from "lucide-react";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <Card>
        <EmptyState
          icon={BarChart3}
          title="Nothing to show yet"
          description="Weekly charts, focus time by subject and study streaks are calculated from your recorded sessions. They are built in Phase 6."
        />
      </Card>
    </div>
  );
}
