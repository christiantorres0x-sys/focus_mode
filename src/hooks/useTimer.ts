import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "./useSettings";
import { getTimerState, onTimerStateChanged } from "../services/storage";
import { sendTimerCommand } from "../services/timerClient";
import { getRemainingMs, getTotalMs } from "../services/timerLogic";
import type { FocusContext } from "../types/session";
import { DEFAULT_TIMER_STATE, type TimerAction, type TimerState } from "../types/timer";

export interface UseTimerResult {
  ready: boolean;
  state: TimerState;
  remainingMs: number;
  totalMs: number;
  error: string | null;
  run: (action: TimerAction, context?: FocusContext) => Promise<void>;
}

// Gives a React page the live timer. The page never owns the timer: it reads the
// saved state, shows a countdown computed from the end timestamp, and sends
// commands to the background worker.
export function useTimer(): UseTimerResult {
  const { settings } = useSettings();
  const [state, setState] = useState<TimerState>(DEFAULT_TIMER_STATE);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  // Load the saved state, ask the background to catch up (this is how the timer
  // recovers after a browser restart), and follow later changes.
  useEffect(() => {
    let active = true;

    getTimerState()
      .then((saved) => active && setState(saved))
      .catch((e) => {
        console.error("[Focus Mode] could not load timer state", e);
        if (active) setError("Could not load the timer. Try reloading the extension.");
      })
      .finally(() => active && setReady(true));

    sendTimerCommand("reconcile")
      .then((fresh) => active && setState(fresh))
      .catch((e) => console.error("[Focus Mode] timer catch-up failed", e));

    const unsubscribe = onTimerStateChanged((fresh) => active && setState(fresh));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Re-render a few times per second while running. This only refreshes the
  // display: the real time left always comes from the end timestamp.
  useEffect(() => {
    if (state.status !== "running") return;
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [state.status, state.endsAt]);

  const remainingMs = getRemainingMs(state, settings, now);
  const totalMs = getTotalMs(state, settings);

  // When the countdown hits zero, ask the background to finish the phase right
  // away. (The alarm does the same; this just avoids waiting for it.)
  const requestedFor = useRef<number | null>(null);
  useEffect(() => {
    if (state.status !== "running" || state.endsAt === null || remainingMs > 0) return;
    if (requestedFor.current === state.endsAt) return;
    requestedFor.current = state.endsAt;
    sendTimerCommand("reconcile").catch((e) => console.error("[Focus Mode] could not finish phase", e));
  }, [state.status, state.endsAt, remainingMs]);

  const run = useCallback(async (action: TimerAction, context?: FocusContext) => {
    try {
      setError(null);
      setState(await sendTimerCommand(action, context));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }, []);

  return { ready, state, remainingMs, totalMs, error, run };
}
