import type { TrackedShow } from '../types/show';
import { getPosterProgress } from '../utils/progress';
import { useAppStore } from '../store/store';

const BAR_COLOR: Record<string, string> = {
  purple: 'bg-purple-500',
  green: 'bg-ok-500',
  yellow: 'bg-warn-500',
  none: 'bg-transparent',
};

interface Props {
  show: TrackedShow;
}

export function ShowPoster({ show }: Props) {
  const setSelectedShow = useAppStore((s) => s.setSelectedShow);
  const progress = getPosterProgress(show);

  return (
    <button
      onClick={() => setSelectedShow(show.id)}
      className="group flex flex-col gap-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500 focus-visible:outline-offset-2 rounded-lg"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink-800 ring-1 ring-inset ring-ink-800 transition-transform group-active:scale-[0.97]">
        {show.posterUrl ? (
          <img
            src={show.posterUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-ink-500">
            {show.title}
          </div>
        )}

        {/* Progress bar track, pinned to the bottom edge of the poster */}
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-ink-950/80">
          <div
            className={`h-full rounded-r-sm transition-[width] ${BAR_COLOR[progress.color]}`}
            style={{ width: `${Math.max(progress.fraction * 100, progress.fraction > 0 ? 6 : 0)}%` }}
          />
        </div>
      </div>
      <p className="truncate text-xs font-medium text-ink-200">{show.title}</p>
    </button>
  );
}
