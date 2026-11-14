import { useEffect, useState } from "react";
import { getSessions, onSessionsChanged } from "../services/storage";
import type { StudySession } from "../types/session";

// Follows the recorded focus sessions. Only the background worker writes them.
export function useSessions(): { ready: boolean; sessions: StudySession[] } {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getSessions()
      .then((saved) => active && setSessions(saved))
      .catch((e) => console.error("[Focus Mode] could not load sessions", e))
      .finally(() => active && setReady(true));
    const unsubscribe = onSessionsChanged((saved) => active && setSessions(saved));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { ready, sessions };
}
