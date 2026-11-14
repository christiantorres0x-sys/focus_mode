import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SETTINGS, type ThemeMode, type UserSettings } from "../types/settings";
import { getSettings, onSettingsChanged, updateSettings as saveSettings } from "../services/storage";

interface SettingsContextValue {
  settings: UserSettings;
  // Resolves after the change is saved; rejects if saving failed, and the old value
  // stays on screen so an unsaved change is never shown as saved (SRS 9.3).
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Adds or removes the "dark" class on <html>. Used by the popup, dashboard and
// blocked page so the theme is consistent everywhere (FR-42).
function applyTheme(theme: ThemeMode) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load once, then stay in sync with changes made elsewhere.
  useEffect(() => {
    let active = true;
    getSettings()
      .then((s) => active && setSettings(s))
      .catch((error) => console.error("[Focus Mode] could not load settings", error))
      .finally(() => active && setLoaded(true));
    const unsubscribe = onSettingsChanged((s) => active && setSettings(s));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Apply the theme, and follow the operating system when set to "system".
  useLayoutEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    const saved = await saveSettings(patch);
    setSettings(saved);
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);

  // Wait for the stored theme so the page never flashes the wrong colours.
  if (!loaded) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
