import { useEffect, useState } from "react";

// The current time, refreshed once a minute. Pages that show "today" use it so the
// numbers move to the new day by themselves if the page stays open past midnight.
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
