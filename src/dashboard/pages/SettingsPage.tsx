import { Info, Palette } from "lucide-react";
import Card from "../../components/ui/Card";
import ThemeSwitcher from "../../components/ThemeSwitcher";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card
        title="Appearance"
        icon={Palette}
        description="Choose Light, Dark, or follow your system. This applies to the popup, dashboard and blocked page."
      >
        <ThemeSwitcher />
      </Card>

      <Card title="About blocking" icon={Info}>
        <p className="text-sm text-muted">
          Focus Mode is a productivity aid. Website blocking only applies in this browser profile and can be bypassed
          by disabling the extension, using another browser, or using another device. Your data stays on this device.
        </p>
      </Card>
    </div>
  );
}
