import { useId, useState } from "react";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  // Throw to show a "could not save" message.
  onChange: (checked: boolean) => Promise<void>;
}

export default function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const labelId = useId();
  const descriptionId = useId();
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    try {
      setError(null);
      await onChange(!checked);
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
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            checked ? "bg-brand" : "bg-line"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
