import { CircleHelp, TriangleAlert } from 'lucide-react';

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
 * (skip-ahead and rewatch) and other "are you sure" moments. Buttons
 * are sized generously for mobile — this is the kind of dialog
 * someone is tapping through quickly while going down a season, so
 * the targets need to be easy to hit. */
export function ConfirmDialog({ title, message, actions, onDismiss }: Props) {
  const isDanger = actions.some((a) => a.variant === 'danger');
  const Icon = isDanger ? TriangleAlert : CircleHelp;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      style={{ animation: 'dialog-backdrop-in 0.2s ease' }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-t-3xl border border-ink-800 bg-ink-900 p-6 shadow-2xl shadow-black/50 sm:rounded-2xl"
        style={{
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          animation: 'dialog-sheet-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              isDanger ? 'bg-red-400/10 text-red-400' : 'bg-signal-500/10 text-signal-500'
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-base font-semibold text-ink-100">{title}</h3>
            <p className="text-sm leading-relaxed text-ink-300">{message}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`min-h-12 w-full rounded-xl px-4 text-sm font-semibold transition-colors active:scale-[0.98] ${
                action.variant === 'primary'
                  ? 'bg-signal-500 text-ink-950 hover:bg-signal-600'
                  : action.variant === 'danger'
                    ? 'bg-red-400/10 text-red-400 hover:bg-red-400/20'
                    : 'border border-ink-700 text-ink-100 hover:border-ink-600'
              }`}
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={onDismiss}
            className="min-h-12 w-full rounded-xl bg-ink-800 px-4 text-sm font-semibold text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-100 active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
