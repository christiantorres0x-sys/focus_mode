import { useRef } from "react";
import type { LucideIcon } from "lucide-react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  label: string; // accessible name for the whole group
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  hideLabels?: boolean; // show only icons (labels stay available to screen readers)
}

// A radio group styled as a pill. Arrow keys move between options.
export default function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabels = false,
}: SegmentedControlProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number, delta: number) => {
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-xl border border-line bg-app p-1"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
              selected ? "bg-brand text-on-brand shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {!hideLabels && option.label}
          </button>
        );
      })}
    </div>
  );
}
