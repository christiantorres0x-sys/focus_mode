import { LayoutDashboard, Timer } from "lucide-react";
import Button from "../components/ui/Button";
import ThemeSwitcher from "../components/ThemeSwitcher";
import TimerPanel from "../components/TimerPanel";

export default function App() {
  // Opens the full dashboard (the extension's options page) in a tab.
  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <main className="p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-on-brand">
            <Timer size={20} aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Focus Mode</h1>
        </div>
        <Button
          variant="ghost"
          icon={LayoutDashboard}
          onClick={openDashboard}
          aria-label="Open dashboard"
          title="Open dashboard"
          className="!px-2.5"
        />
      </header>

      <section aria-label="Timer" className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <TimerPanel compact />
      </section>

      <footer className="mt-3 flex items-center justify-between">
        <span className="text-sm text-muted">Theme</span>
        <ThemeSwitcher compact />
      </footer>
    </main>
  );
}
