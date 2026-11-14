import { Info, Palette, Target } from "lucide-react";
import Card from "../../components/ui/Card";
import NumberField from "../../components/ui/NumberField";
import { useSettings } from "../../hooks/useSettings";
import { SETTING_LIMITS } from "../../types/settings";
import ThemeSwitcher from "../../components/ThemeSwitcher";
import NotificationsCard from "../../components/NotificationsCard";
import DataCard from "../../components/DataCard";
import TimerSettingsCard from "../../components/TimerSettingsCard";

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <TimerSettingsCard />

      <NotificationsCard />

      <Card title="Daily goal" icon={Target} description="Used by the goal progress bars in the popup and dashboard.">
        <NumberField
          id="setting-dailyGoalMinutes"
          label="Focus goal per day"
          unit="min"
          value={settings.dailyGoalMinutes}
          min={SETTING_LIMITS.dailyGoalMinutes.min}
          max={SETTING_LIMITS.dailyGoalMinutes.max}
          onCommit={(value) => updateSettings({ dailyGoalMinutes: value })}
        />
      </Card>

      <Card
        title="Appearance"
        icon={Palette}
        description="Choose Light, Dark, or follow your system. This applies to the popup, dashboard and blocked page."
      >
        <ThemeSwitcher />
      </Card>

      <DataCard />

      <Card title="About blocking" icon={Info}>
        <p className="text-sm text-muted">
          Focus Mode is a productivity aid. Website blocking only applies in this browser profile and can be bypassed
          by disabling the extension, using another browser, or using another device. Your data stays on this device.
        </p>
      </Card>
    </div>
  );
}
