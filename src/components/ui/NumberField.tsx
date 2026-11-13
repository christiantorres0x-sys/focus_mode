import { useEffect, useState } from "react";

interface NumberFieldProps {
  id: string;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  // Called with a valid whole number. Throw to show a "could not save" message.
  onCommit: (value: number) => Promise<void>;
}

// A whole-number input that saves when you press Enter or leave the field, and
// shows a clear message instead of saving when the value is invalid.
export default function NumberField({ id, label, description, value, min, max, unit, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  // Follow the saved value (for example after a reset or a change elsewhere).
  useEffect(() => {
    setText(String(value));
    setError(null);
  }, [value]);

  const commit = async () => {
    const trimmed = text.trim();
    const parsed = Number(trimmed);
    if (trimmed === "" || !Number.isInteger(parsed) || parsed < min || parsed > max) {
      setError(`Enter a whole number from ${min} to ${max}.`);
      return;
    }
    setError(null);
    if (parsed === value) return;
    try {
      await onCommit(parsed);
    } catch (e) {
      console.error("[Focus Mode] could not save setting", e);
      setError("Could not save this change. Please try again.");
    }
  };

  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-xs text-muted">
            {description}
          </p>
        )}
      </div>
      <div className="sm:text-right">
        <div className="flex items-center gap-2 sm:justify-end">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-invalid={error !== null}
            aria-describedby={[description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
            className="w-20 rounded-lg border border-line bg-app px-3 py-1.5 text-right text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand aria-[invalid=true]:border-red-500"
          />
          {unit && <span className="w-16 text-sm text-muted">{unit}</span>}
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
