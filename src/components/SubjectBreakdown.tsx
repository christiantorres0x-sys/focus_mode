import type { SubjectShare } from "../utils/analytics";
import { formatDuration } from "../utils/time";

// Focus time per subject as labelled bars. Plain markup, so it is readable by
// screen readers as a list and needs no extra table.
export default function SubjectBreakdown({ items }: { items: SubjectShare[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const percent = Math.round(item.share * 100);
        return (
          <li key={item.subject}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{item.subject}</span>
              <span className="shrink-0 text-muted">
                {formatDuration(item.focusMs)} · {percent}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(percent, 2)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
