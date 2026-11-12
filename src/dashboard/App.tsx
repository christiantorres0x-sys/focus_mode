import { BarChart3, LayoutDashboard, ListChecks, Settings, Timer, type LucideIcon } from "lucide-react";
import { ROUTES, useHashRoute, type Route } from "../hooks/useHashRoute";
import OverviewPage from "./pages/OverviewPage";
import TasksPage from "./pages/TasksPage";
import InsightsPage from "./pages/InsightsPage";
import SettingsPage from "./pages/SettingsPage";

const NAV: Record<Route, { label: string; icon: LucideIcon }> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  tasks: { label: "Tasks", icon: ListChecks },
  insights: { label: "Insights", icon: BarChart3 },
  settings: { label: "Settings", icon: Settings },
};

const PAGES: Record<Route, () => React.JSX.Element> = {
  overview: OverviewPage,
  tasks: TasksPage,
  insights: InsightsPage,
  settings: SettingsPage,
};

export default function App() {
  const route = useHashRoute();
  const Page = PAGES[route];

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-on-brand">
            <Timer size={20} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Focus Mode</span>
        </div>

        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {ROUTES.map((name) => {
            const { label, icon: Icon } = NAV[name];
            const active = name === route;
            return (
              <a
                key={name}
                href={`#/${name}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                  active ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-ink"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </a>
            );
          })}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-4xl flex-1 p-5 md:p-8">
        <Page />
      </main>
    </div>
  );
}
