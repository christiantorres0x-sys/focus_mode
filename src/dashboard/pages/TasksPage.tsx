import { ListChecks } from "lucide-react";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      <Card>
        <EmptyState
          icon={ListChecks}
          title="No study tasks yet"
          description="Study tasks with a subject and estimated time will live here. Task management is built in Phase 5."
        />
      </Card>
    </div>
  );
}
