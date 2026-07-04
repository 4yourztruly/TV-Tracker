import { useAppStore } from '../store/store';
import { SeasonAccordion } from '../components/SeasonAccordion';
import { syncToDrive } from '../store/sync';
import { toggleEpisodeWatched, toggleSeasonWatched } from '../utils/progress';
import type { WatchStatus } from '../types/show';

const STATUS_OPTIONS: { value: WatchStatus; label: string }[] = [
  { value: 'unwatched', label: 'Watchlist' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
];

export function ShowDetailScreen() {
  const selectedShowId = useAppStore((s) => s.selectedShowId);
  const setSelectedShow = useAppStore((s) => s.setSelectedShow);
  const previewShow = useAppStore((s) => s.previewShow);
  const setPreviewShow = useAppStore((s) => s.setPreviewShow);
  const shows = useAppStore((s) => s.shows);
  const addShow = useAppStore((s) => s.addShow);
  const toggleEpisode = useAppStore((s) => s.toggleEpisode);
  const toggleSeason = useAppStore((s) => s.toggleSeason);
  const setShowStatus = useAppStore((s) => s.setShowStatus);
  const removeShow = useAppStore((s) => s.removeShow);

  const trackedShow = shows.find((s) => s.id === selectedShowId);
  // Preview mode: viewing a search result's details before it's been
  // added to the tracker. Kept out of the main `shows` list/Drive sync
  // until the user explicitly adds it.
  const isPreview = !trackedShow && !!previewShow;
  const show = trackedShow ?? previewShow;
  if (!show) return null;

  function handleClose() {
    setSelectedShow(null);
    setPreviewShow(null);
  }

  function handleToggleEpisode(season: number, episode: number) {
    if (isPreview) {
      // Toggling an episode while previewing adds the show, with just
      // that one episode marked watched — not implying anything before
      // it was watched too. We then point selectedShowId at it so the
      // same detail view stays open (previewShow gets cleared by
      // addShow, so without this the screen would otherwise vanish).
      const newShow = {
        ...show!,
        status: 'watching' as const,
        watchedEpisodes: toggleEpisodeWatched(show!, season, episode),
      };
      addShow(newShow);
      setSelectedShow(newShow.id);
      syncToDrive();
      return;
    }
    toggleEpisode(show!.id, season, episode);
    syncToDrive();
  }

  function handleToggleSeason(season: number) {
    if (isPreview) {
      const newShow = {
        ...show!,
        status: 'watching' as const,
        watchedEpisodes: toggleSeasonWatched(show!, season),
      };
      addShow(newShow);
      setSelectedShow(newShow.id);
      syncToDrive();
      return;
    }
    toggleSeason(show!.id, season);
    syncToDrive();
  }

  function handleAddToWatchlist() {
    addShow(show!);
    syncToDrive();
    handleClose();
  }

  function handleStatusChange(status: WatchStatus) {
    setShowStatus(show!.id, status);
    syncToDrive();
  }

  function handleRemove() {
    if (confirm(`Remove "${show!.title}" from your tracker?`)) {
      removeShow(show!.id);
      syncToDrive();
      handleClose();
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-center bg-black/40">
      <div className="flex h-full w-full max-w-[480px] flex-col bg-ink-950 md:border-x md:border-ink-800">
        <div className="sticky top-0 flex items-center gap-3 border-b border-ink-800 bg-ink-950/95 px-4 py-3 backdrop-blur">
          <button onClick={handleClose} className="text-ink-300 hover:text-ink-100" aria-label="Back">
            &larr;
          </button>
          <h2 className="truncate text-sm font-semibold text-ink-100">{show.title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex gap-4">
            {show.posterUrl ? (
              <img
                src={show.posterUrl}
                alt=""
                className="h-32 w-22 flex-shrink-0 rounded-lg object-cover bg-ink-800"
              />
            ) : (
              <div className="h-32 w-22 flex-shrink-0 rounded-lg bg-ink-800" />
            )}
            <div className="flex flex-col gap-2">
              {isPreview ? (
                <button
                  onClick={handleAddToWatchlist}
                  className="w-fit rounded-md bg-signal-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-signal-600"
                >
                  Add to Watchlist
                </button>
              ) : (
                <div className="flex gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const label =
                      opt.value === 'completed' && show.seriesStatus === 'ongoing'
                        ? 'Up to date'
                        : opt.label;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          show.status === opt.value
                            ? 'bg-signal-500 text-ink-950'
                            : 'border border-ink-700 text-ink-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-ink-400">
                {show.totalEpisodes != null
                  ? `${show.totalEpisodes} total episodes`
                  : 'Episode count unknown (still airing)'}
              </p>
              {isPreview && (
                <p className="text-xs text-ink-400">
                  Check an episode or season below to add &amp; start tracking.
                </p>
              )}
            </div>
          </div>

          {show.summary && (
            <p className="mt-4 text-sm leading-relaxed text-ink-200">{show.summary}</p>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Seasons</h3>
            {show.seasons.map((season) => (
              <SeasonAccordion
                key={season.season}
                show={show}
                season={season}
                onToggleEpisode={handleToggleEpisode}
                onToggleSeason={handleToggleSeason}
              />
            ))}
          </div>

          {!isPreview && (
            <button
              onClick={handleRemove}
              className="mt-8 w-full rounded-lg border border-ink-800 py-2 text-xs font-medium text-red-400 hover:border-red-400"
            >
              Remove from tracker
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
