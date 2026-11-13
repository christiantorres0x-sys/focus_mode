interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Give either aria-label or aria-labelledby so screen readers know what it controls.
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

// An on/off switch (role="switch"). Used on its own in lists and inside Toggle.
export default function Switch({ checked, onChange, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        checked ? "bg-brand" : "bg-line"
      }`}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
