import { useEffect, useState } from "react";
import { Bell, Volume2 } from "lucide-react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Toggle from "./ui/Toggle";
import { useSettings } from "../hooks/useSettings";
import { notificationPermission, sendTestNotification, testSound } from "../services/dataActions";

export default function NotificationsCard() {
  const { settings, updateSettings } = useSettings();
  const [permission, setPermission] = useState<"granted" | "denied" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    notificationPermission().then(setPermission);
  }, []);

  const run = async (action: () => Promise<void>, done: string, failed: string) => {
    try {
      await action();
      setMessage({ text: done, error: false });
    } catch (e) {
      console.error("[Focus Mode]", failed, e);
      setMessage({ text: failed, error: true });
    }
  };

  return (
    <Card title="Notifications and sound" icon={Bell} description="Alerts when a focus session or a break ends (FR-37).">
      <div className="space-y-4">
        <Toggle
          label="Show a notification when a phase ends"
          description="Uses your browser's notifications. Nothing is sent anywhere."
          checked={settings.notificationsEnabled}
          onChange={(checked) => updateSettings({ notificationsEnabled: checked })}
        />
        <Toggle
          label="Play a sound when a phase ends"
          description="A short chime. It plays even if notifications are off."
          checked={settings.soundEnabled}
          onChange={(checked) => updateSettings({ soundEnabled: checked })}
        />

        {permission === "denied" && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Notifications look blocked by your browser or operating system, so you may not see them. The timer works
            normally either way. Check your system notification settings for this browser.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={Bell}
            onClick={() => run(sendTestNotification, "Test notification sent.", "The test notification could not be shown.")}
          >
            Test notification
          </Button>
          <Button
            variant="secondary"
            icon={Volume2}
            onClick={() => run(testSound, "Test sound played.", "The sound could not be played.")}
          >
            Test sound
          </Button>
        </div>
        {message && (
          <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
            {message.text}
          </p>
        )}
      </div>
    </Card>
  );
}
