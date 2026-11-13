import { Timer } from "lucide-react";
import Card from "./ui/Card";
import NumberField from "./ui/NumberField";
import Toggle from "./ui/Toggle";
import { useSettings } from "../hooks/useSettings";
import { SETTING_LIMITS, type UserSettings } from "../types/settings";

type NumericKey = "focusDuration" | "shortBreakDuration" | "longBreakDuration" | "longBreakInterval";

const FIELDS: { key: NumericKey; label: string; description?: string; unit: string }[] = [
  { key: "focusDuration", label: "Focus", unit: "min" },
  { key: "shortBreakDuration", label: "Short break", unit: "min" },
  { key: "longBreakDuration", label: "Long break", unit: "min" },
  {
    key: "longBreakInterval",
    label: "Long break after",
    description: "Number of focus sessions before a long break.",
    unit: "sessions",
  },
];

export default function TimerSettingsCard() {
  const { settings, updateSettings } = useSettings();

  const save = (patch: Partial<UserSettings>) => updateSettings(patch);

  return (
    <Card
      title="Timer"
      icon={Timer}
      description="Changes apply to the next phase. A phase that is already running keeps its length."
    >
      <div className="space-y-4">
        {FIELDS.map(({ key, label, description, unit }) => (
          <NumberField
            key={key}
            id={`setting-${key}`}
            label={label}
            description={description}
            unit={unit}
            value={settings[key]}
            min={SETTING_LIMITS[key].min}
            max={SETTING_LIMITS[key].max}
            onCommit={(value) => save({ [key]: value })}
          />
        ))}

        <hr className="border-line" />

        <Toggle
          label="Start breaks automatically"
          description="When a focus session ends, the break starts by itself."
          checked={settings.autoStartBreaks}
          onChange={(checked) => save({ autoStartBreaks: checked })}
        />
        <Toggle
          label="Start focus automatically"
          description="When a break ends, the next focus session starts by itself."
          checked={settings.autoStartFocus}
          onChange={(checked) => save({ autoStartFocus: checked })}
        />
      </div>
    </Card>
  );
}
