import { LayoutDashboard, Pause, Play, SkipForward, Timer, RotateCcw } from "lucide-react";
import Button from "../components/ui/Button";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useSettings } from "../hooks/useSettings";
import { formatClock } from "../utils/time";

export default function App() {
  const { settings } = useSettings();

  // Opens the full dashboard (the extension's options page) in a tab.
  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <main className="p-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-on-brand">
            <Timer size={20} aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Focus Mode</h1>
        </div>
        <Button variant="ghost" icon={LayoutDashboard} onClick={openDashboard} aria-label="Open dashboard" className="!px-2.5" />
      </header>

      <section
        aria-label="Timer"
        className="mt-5 rounded-2xl border border-line bg-surface p-5 text-center shadow-sm"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-brand">Focus</p>
        <p className="mt-2 text-5xl font-semibold tabular-nums" aria-live="off">
          {formatClock(settings.focusDuration * 60)}
        </p>
        <p className="mt-1 text-sm text-muted">Ready to start a {settings.focusDuration}-minute session</p>

        {/* Timer logic arrives in Phase 3, so these stay disabled until then. */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button icon={Play} disabled>
            Start
          </Button>
          <Button variant="secondary" icon={Pause} disabled aria-label="Pause" className="!px-2.5" />
          <Button variant="secondary" icon={RotateCcw} disabled aria-label="Reset" className="!px-2.5" />
          <Button variant="secondary" icon={SkipForward} disabled aria-label="Skip" className="!px-2.5" />
        </div>
        <p className="mt-3 text-xs text-muted">Timer controls unlock in Phase 3.</p>
      </section>

      <footer className="mt-5 flex items-center justify-between">
        <span className="text-sm text-muted">Theme</span>
        <ThemeSwitcher compact />
      </footer>
    </main>
  );
}
