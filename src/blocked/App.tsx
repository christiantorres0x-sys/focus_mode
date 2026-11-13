import { useState } from "react";
import { ArrowLeft, ExternalLink, LayoutDashboard, ShieldAlert } from "lucide-react";
import Button from "../components/ui/Button";
import { useTimer } from "../hooks/useTimer";
import { formatClock } from "../utils/time";
import { normalizeDomain } from "../utils/domain";

// The redirect rule adds ?site=<domain>. We re-validate it before using it, so a
// hand-written URL can never put odd text on the page or in the link below.
function readBlockedSite(): string | null {
  const raw = new URLSearchParams(window.location.search).get("site");
  if (!raw) return null;
  const parsed = normalizeDomain(raw);
  return parsed.ok ? parsed.domain : null;
}

export default function App() {
  const site = readBlockedSite();
  const { ready, state, remainingMs, error, run } = useTimer();
  const [confirming, setConfirming] = useState(false);

  const focusRunning = state.status === "running" && state.phase === "focus";
  const name = site ?? "This site";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto text-brand" size={40} aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">
          {focusRunning ? "Stay focused" : site ? `${site} isn't blocked right now` : "Nothing is blocked right now"}
        </h1>

        {!ready ? (
          <div className="mt-4 h-16" aria-busy="true" />
        ) : focusRunning ? (
          <>
            <p className="mt-2 text-sm text-muted">
              {name} is blocked during your focus session.
            </p>
            <div className="mt-5 rounded-xl bg-brand-soft px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand">Focus time left</p>
              <p
                role="timer"
                aria-label={`${Math.ceil(remainingMs / 60000)} minutes remaining`}
                className="mt-1 text-4xl font-semibold tabular-nums"
              >
                {formatClock(Math.ceil(remainingMs / 1000))}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Focus blocking is only on while a focus session is running. Your session may have ended, been paused, or
            switched to a break.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {ready && !focusRunning && site && (
            <a
              href={`https://${site}/`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Continue to {site}
            </a>
          )}
          {window.history.length > 1 && (
            <Button variant="secondary" icon={ArrowLeft} onClick={() => window.history.back()}>
              Go back
            </Button>
          )}
          <Button variant="secondary" icon={LayoutDashboard} onClick={() => chrome.runtime.openOptionsPage()}>
            Open dashboard
          </Button>
        </div>

        {focusRunning && (
          <div className="mt-6 border-t border-line pt-4">
            {confirming ? (
              <div>
                <p className="text-sm text-muted">End this focus session? Your timer will stop and sites unblock.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    onClick={async () => {
                      await run("reset");
                      setConfirming(false);
                    }}
                  >
                    Yes, end session
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(false)}>
                    Keep focusing
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-sm text-muted underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                End focus session early
              </button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
