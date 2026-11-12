import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import SegmentedControl, { type SegmentOption } from "./ui/SegmentedControl";
import { useSettings } from "../hooks/useSettings";
import type { ThemeMode } from "../types/settings";

const OPTIONS: SegmentOption<ThemeMode>[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { settings, updateSettings } = useSettings();
  const [error, setError] = useState<string | null>(null);

  const change = async (theme: ThemeMode) => {
    try {
      setError(null);
      await updateSettings({ theme });
    } catch (e) {
      console.error("[Focus Mode] could not save theme", e);
      setError("Could not save your theme choice. Please try again.");
    }
  };

  return (
    <div>
      <SegmentedControl
        label="Theme"
        value={settings.theme}
        options={OPTIONS}
        onChange={change}
        hideLabels={compact}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
