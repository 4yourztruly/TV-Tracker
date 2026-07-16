import type { TrackedShow } from '../types/show';
import { useAppStore } from '../store/store';

interface Props {
  show: TrackedShow;
  season: number;
  episode: number;
}

/** A single Watch History row — one specific episode that was marked
 * watched from the Home screen. Deliberately greyed out (muted text,
 * desaturated poster) so it doesn't read as an actionable show card —
 * it's a log entry, not a "your shows" tile. Tapping it opens the
 * show's detail screen with that episode's season pre-expanded and
 * scrolled into view, via `pendingEpisodeFocus` (see
 * ShowDetailScreen/SeasonAccordion). */
export function WatchHistoryItem({ show, season, episode }: Props) {
  const pushOverlay = useAppStore((s) => s.pushOverlay);
  const setPendingEpisodeFocus = useAppStore((s) => s.setPendingEpisodeFocus);

  const episodeTitle = show.seasons
    .find((s) => s.season === season)
    ?.episodes?.find((e) => e.episode === episode)?.title;

  function handleClick() {
    setPendingEpisodeFocus({ season, episode });
    pushOverlay({ selectedShowId: show.id });
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-stretch gap-3 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/60 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500"
    >
      {show.posterUrl ? (
        <img
          src={show.posterUrl}
          alt=""
          className="h-full w-24 flex-shrink-0 grayscale object-cover bg-ink-800"
        />
      ) : (
        <div className="h-full w-24 flex-shrink-0 bg-ink-800" />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-3.5 pr-3.5">
        <p className="truncate text-sm font-medium text-ink-400">{show.title}</p>
        <div className="flex items-center text-sm text-ink-500">
          <span className="font-semibold">S{season}</span>
          <span className="mx-1.5 h-3.5 w-px bg-ink-700" aria-hidden="true" />
          <span className="font-semibold">E{episode}</span>
        </div>
        {episodeTitle && <p className="truncate text-xs text-ink-600">{episodeTitle}</p>}
      </div>
    </div>
  );
}
