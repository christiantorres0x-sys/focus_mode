import { useState } from "react";
import { BarChart3, BookOpen, CalendarDays, Flame, History } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import SegmentedControl from "../../components/ui/SegmentedControl";
import DailyFocusChart from "../../components/charts/DailyFocusChart";
import SessionRow from "../../components/SessionRow";
import SubjectBreakdown from "../../components/SubjectBreakdown";
import { useNow } from "../../hooks/useNow";
import { useSessions } from "../../hooks/useSessions";
import { useSettings } from "../../hooks/useSettings";
import {
  changePercent,
  computeStreaks,
  dailySeries,
  filterHistory,
  lastDays,
  previousDays,
  sessionsInDays,
  subjectBreakdown,
  summarizePeriod,
  type HistoryFilter,
} from "../../utils/analytics";
import { formatDuration } from "../../utils/time";

type Range = "7" | "30";
const PAGE = 15;

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-app p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-muted">{note}</dd>}
    </div>
  );
}

export default function InsightsPage() {
  const { ready, sessions } = useSessions();
  const { settings } = useSettings();
  const [range, setRange] = useState<Range>("7");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [shown, setShown] = useState(PAGE);

  const now = useNow();
  const count = Number(range);
  const days = lastDays(count, now);
  const inRange = sessionsInDays(sessions, days);
  const series = dailySeries(inRange, days);
  const period = summarizePeriod(inRange, series);
  const previous = summarizePeriod(
    sessionsInDays(sessions, previousDays(count, now)),
    dailySeries([], previousDays(count, now)),
  );
  const delta = changePercent(period.focusMs, previous.focusMs);
  const subjects = subjectBreakdown(inRange);
  const streaks = computeStreaks(sessions, settings.dailyGoalMinutes, now);
  const history = filterHistory(inRange, filter);
  const label = range === "7" ? "last 7 days" : "last 30 days";

  if (!ready) return <div className="h-80" aria-busy="true" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <SegmentedControl<Range>
          label="Time range"
          value={range}
          options={[
            { value: "7", label: "7 days", icon: CalendarDays },
            { value: "30", label: "30 days", icon: CalendarDays },
          ]}
          onChange={(value) => {
            setRange(value);
            setShown(PAGE);
          }}
        />
      </div>

      {sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Nothing to show yet"
            description="Finish or stop a focus session after at least a minute and your charts, subjects and streaks will appear here."
          />
        </Card>
      ) : (
        <>
          <Card title={`Summary, ${label}`} icon={BarChart3}>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile
                label="Total focus time"
                value={formatDuration(period.focusMs)}
                note={delta === null ? "No earlier period to compare" : `${delta >= 0 ? "+" : ""}${delta}% vs previous ${count} days`}
              />
              <Tile label="Daily average" value={formatDuration(period.averageMs)} />
              <Tile
                label="Sessions"
                value={`${period.completed + period.interrupted}`}
                note={`${period.completed} completed · ${period.interrupted} interrupted`}
              />
              <Tile
                label="Best day"
                value={period.bestDay ? formatDuration(period.bestDay.focusMs) : "None yet"}
                note={
                  period.bestDay
                    ? new Date(
                        Number(period.bestDay.key.slice(0, 4)),
                        Number(period.bestDay.key.slice(5, 7)) - 1,
                        Number(period.bestDay.key.slice(8, 10)),
                      ).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
                    : undefined
                }
              />
            </dl>
            {period.completionRate !== null && (
              <p className="mt-3 text-sm text-muted">
                {Math.round(period.completionRate * 100)}% of the sessions you started in this period were completed.
              </p>
            )}
          </Card>

          <Card title="Focus time per day" icon={CalendarDays} description={`Minutes of focus each day, with your ${settings.dailyGoalMinutes} minute goal.`}>
            <DailyFocusChart series={series} goalMinutes={settings.dailyGoalMinutes} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="By subject" icon={BookOpen} description={`Focus time by subject, ${label}.`}>
              {subjects.length === 0 ? (
                <p className="text-sm text-muted">No sessions in this period.</p>
              ) : (
                <SubjectBreakdown items={subjects} />
              )}
            </Card>

            <Card
              title="Streaks"
              icon={Flame}
              description={`A day counts when you reach your daily goal (${settings.dailyGoalMinutes} min). Changing the goal changes past days too.`}
            >
              <dl className="grid grid-cols-2 gap-3">
                <Tile label="Current streak" value={`${streaks.current} ${streaks.current === 1 ? "day" : "days"}`} note={streaks.todayMet ? "Today's goal is done" : streaks.current > 0 ? "Reach today's goal to extend it" : undefined} />
                <Tile label="Longest streak" value={`${streaks.longest} ${streaks.longest === 1 ? "day" : "days"}`} />
              </dl>
            </Card>
          </div>

          <Card title="Session history" icon={History} description={`Sessions from the ${label}, newest first.`}>
            <SegmentedControl<HistoryFilter>
              label="Show sessions"
              value={filter}
              options={[
                { value: "all", label: "All" },
                { value: "completed", label: "Completed" },
                { value: "interrupted", label: "Interrupted" },
              ]}
              onChange={(value) => {
                setFilter(value);
                setShown(PAGE);
              }}
            />
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No sessions match in this period.</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-line" aria-label="Session history">
                  {history.slice(0, shown).map((session) => (
                    <SessionRow key={session.id} session={session} showDate />
                  ))}
                </ul>
                {history.length > shown && (
                  <Button variant="secondary" className="mt-3" onClick={() => setShown((current) => current + PAGE)}>
                    Show more ({history.length - shown} left)
                  </Button>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
