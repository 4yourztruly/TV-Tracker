interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

/** A labeled on/off switch row, styled to match the app's existing
 * border/rounded-lg settings rows. */
export function Toggle({ checked, onChange, label, description }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink-100">{label}</span>
        {description && <span className="text-xs text-ink-400">{description}</span>}
      </span>
      <span
        className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
          checked ? 'bg-signal-500' : 'bg-ink-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-ink-100 transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
