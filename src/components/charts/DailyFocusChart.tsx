import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint } from "../../utils/analytics";
import { formatDuration } from "../../utils/time";

interface DailyFocusChartProps {
  series: DayPoint[];
  goalMinutes: number;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const longLabel = (key: string) => parseKey(key).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

interface TipProps {
  active?: boolean;
  payload?: { payload: { key: string; minutes: number; completed: number; interrupted: number } }[];
}

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{longLabel(point.key)}</p>
      <p className="mt-0.5">{formatDuration(point.minutes * 60_000)} focused</p>
      <p className="text-muted">
        {point.completed} completed · {point.interrupted} interrupted
      </p>
    </div>
  );
}

// Focus minutes per day with the daily goal as a reference line. A table with the
// same numbers is provided for screen readers (the chart itself is decorative).
export default function DailyFocusChart({ series, goalMinutes }: DailyFocusChartProps) {
  const compact = series.length > 10;
  const data = series.map((day) => ({
    key: day.key,
    label: compact
      ? parseKey(day.key).toLocaleDateString([], { month: "short", day: "numeric" })
      : parseKey(day.key).toLocaleDateString([], { weekday: "short" }),
    minutes: Math.round(day.focusMs / 60_000),
    completed: day.completed,
    interrupted: day.interrupted,
  }));
  const top = Math.max(goalMinutes, ...data.map((d) => d.minutes));

  return (
    <div>
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} accessibilityLayer={false} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              interval={compact ? 4 : 0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              allowDecimals={false}
              domain={[0, Math.ceil((top * 1.1) / 10) * 10]}
              unit=" m"
            />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--brand-soft)" }} />
            <ReferenceLine
              y={goalMinutes}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: "Goal", position: "insideTopLeft", fill: "var(--muted)", fontSize: 11 }}
            />
            <Bar dataKey="minutes" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Focus time per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Focus minutes</th>
            <th scope="col">Completed</th>
            <th scope="col">Interrupted</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{longLabel(d.key)}</th>
              <td>{d.minutes}</td>
              <td>{d.completed}</td>
              <td>{d.interrupted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
