import { useId, useState } from "react";
import Switch from "./Switch";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  // Throw to show a "could not save" message.
  onChange: (checked: boolean) => Promise<void>;
}

// A labelled setting row with a switch.
export default function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const labelId = useId();
  const descriptionId = useId();
  const [error, setError] = useState<string | null>(null);

  const change = async (next: boolean) => {
    try {
      setError(null);
      await onChange(next);
    } catch (e) {
      console.error("[Focus Mode] could not save setting", e);
      setError("Could not save this change. Please try again.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id={labelId} className="text-sm font-medium">
            {label}
          </p>
          {description && (
            <p id={descriptionId} className="text-xs text-muted">
              {description}
            </p>
          )}
        </div>
        <Switch
          checked={checked}
          onChange={change}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
        />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
