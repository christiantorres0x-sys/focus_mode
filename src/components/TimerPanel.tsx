import { Armchair, Brain, Coffee, Pause, Play, RotateCcw, SkipForward, type LucideIcon } from "lucide-react";
import { useState } from "react";
import Button from "./ui/Button";
import FocusDetails from "./FocusDetails";
import DailyGoalMeter from "./DailyGoalMeter";
import BlockingNotice from "./BlockingNotice";
import { useTimer } from "../hooks/useTimer";
import { useSettings } from "../hooks/useSettings";
import { formatClock } from "../utils/time";
import type { TimerPhase, TimerState } from "../types/timer";
import { EMPTY_FOCUS_CONTEXT, type FocusContext } from "../types/session";

const PHASES: Record<TimerPhase, { label: string; icon: LucideIcon }> = {
  focus: { label: "Focus", icon: Brain },
  shortBreak: { label: "Short break", icon: Coffee },
  longBreak: { label: "Long break", icon: Armchair },
};

function statusText(state: TimerState): string {
  if (state.status === "paused") return "Paused";
  if (state.status === "idle") return "Ready to start";
  return state.phase === "focus" ? "Stay focused" : "Take a breather";
}

const RADIUS = 78;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TimerPanel({ detailsDefaultOpen = false, compact = false }: { detailsDefaultOpen?: boolean; compact?: boolean }) {
  const { settings } = useSettings();
  const { ready, state, remainingMs, totalMs, error, run } = useTimer();
  const [context, setContext] = useState<FocusContext>(EMPTY_FOCUS_CONTEXT);
  const [seeded, setSeeded] = useState(false);

  // Start from what the timer remembers (the last session's details), once.
  if (ready && !seeded) {
    setSeeded(true);
    setContext(state.intent);
  }

  // Avoid flashing wrong numbers before the saved state has loaded.
  if (!ready) return <div className="h-80" aria-busy="true" />;

  const { label, icon: PhaseIcon } = PHASES[state.phase];
  const seconds = Math.ceil(remainingMs / 1000);
  const clock = formatClock(seconds);
  const progress = state.status === "idle" || totalMs <= 0 ? 0 : Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const cycleLength = settings.longBreakInterval;
  const focusActive = state.phase === "focus" && state.status !== "idle";
  const sessionNumber = (state.completedFocusCount % cycleLength) + 1;

  return (
    <div className="text-center">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
        <PhaseIcon size={14} aria-hidden="true" />
        {label}
      </p>

      <div className={`relative mx-auto ${compact ? "mt-3 h-28 w-28" : "mt-4 h-40 w-40"}`}>
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="90" cy="90" r={RADIUS} fill="none" strokeWidth="8" className="stroke-line" />
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-brand transition-[stroke-dashoffset] duration-300 ease-linear"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p
            role="timer"
            aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`}
            className={`${compact ? "text-2xl" : "text-4xl"} font-semibold tabular-nums`}
          >
            {clock}
          </p>
          <p className="mt-1 text-xs text-muted">{statusText(state)}</p>
        </div>
      </div>

      {state.phase === "focus" && (
        <p className={`${compact ? "mt-2" : "mt-3"} text-xs text-muted`}>
          Session {sessionNumber} of {cycleLength}
        </p>
      )}

      <div className="mt-3 flex items-center justify-center gap-2">
        {state.status === "running" ? (
          <Button icon={Pause} onClick={() => run("pause")}>
            Pause
          </Button>
        ) : state.status === "paused" ? (
          <Button icon={Play} onClick={() => run("resume")}>
            Resume
          </Button>
        ) : (
          <Button icon={Play} onClick={() => run("start", state.phase === "focus" ? context : undefined)}>
            Start
          </Button>
        )}
        <Button
          variant="secondary"
          icon={RotateCcw}
          aria-label={focusActive ? "Stop session early" : "Reset timer"}
          title={focusActive ? "Stop session early (recorded as interrupted)" : "Reset timer"}
          disabled={state.status === "idle"}
          onClick={() => run("reset")}
          className="!px-2.5"
        />
        <Button
          variant="secondary"
          icon={SkipForward}
          aria-label={state.phase === "focus" ? "Skip to break" : "Skip to focus"}
          title={state.phase === "focus" ? "Skip to break (a started session is recorded as interrupted)" : "Skip to focus"}
          onClick={() => run("skip")}
          className="!px-2.5"
        />
      </div>

      {state.phase === "focus" &&
        (focusActive ? (
          (state.intent.title || state.intent.subject) && (
            <p className="mt-3 truncate text-xs text-muted">
              {[state.intent.title, state.intent.subject].filter(Boolean).join(" · ")}
            </p>
          )
        ) : (
          <FocusDetails value={context} onChange={setContext} defaultOpen={detailsDefaultOpen} compact={compact} />
        ))}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 border-t border-line pt-2.5 text-left">
        <DailyGoalMeter compact />
      </div>

      <BlockingNotice focusRunning={state.status === "running" && state.phase === "focus"} />
    </div>
  );
}
