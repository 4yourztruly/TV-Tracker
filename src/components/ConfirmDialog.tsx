interface DialogAction {
  label: string;
  onClick: () => void;
  /** 'primary' gets the signal-colored fill; 'danger' reads as a
   * destructive/undo action; 'neutral' is a plain bordered button. */
  variant?: 'primary' | 'danger' | 'neutral';
}

interface Props {
  title: string;
  message: string;
  actions: DialogAction[];
  onDismiss: () => void;
}

/** A small centered confirm sheet used for the episode-watch prompts
 * (skip-ahead and rewatch). Buttons are sized generously for mobile —
 * this is the kind of dialog someone is tapping through quickly while
 * going down a season, so the targets need to be easy to hit. */
export function ConfirmDialog({ title, message, actions, onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-t-2xl border border-ink-800 bg-ink-900 p-5 sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
          <p className="text-xs leading-relaxed text-ink-300">{message}</p>
        </div>
        <div className="flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`min-h-12 w-full rounded-lg px-4 text-sm font-semibold transition-colors active:scale-[0.98] ${
                action.variant === 'primary'
                  ? 'bg-signal-500 text-ink-950 hover:bg-signal-600'
                  : action.variant === 'danger'
                    ? 'border border-red-400/60 text-red-400 hover:bg-red-400/10'
                    : 'border border-ink-700 text-ink-100 hover:border-ink-600'
              }`}
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={onDismiss}
            className="min-h-12 w-full rounded-lg px-4 text-sm font-medium text-ink-400 hover:text-ink-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
