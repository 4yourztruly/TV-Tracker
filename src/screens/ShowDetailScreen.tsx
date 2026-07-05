import { useState } from 'react';
import { useAppStore } from '../store/store';
import { SeasonAccordion } from '../components/SeasonAccordion';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { syncToDrive } from '../store/sync';
import {
  toggleEpisodeWatched,
  toggleSeasonWatched,
  hasUnwatchedEpisodesBefore,
  markEpisodeAndPriorWatched,
  incrementEpisodeWatchCount,
  isEpisodeWatched,
  getEpisodeWatchCount,
} from '../utils/progress';
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
  const markPriorEpisodesWatched = useAppStore((s) => s.markEpisodeAndPriorWatched);
  const rewatchEpisodeAction = useAppStore((s) => s.rewatchEpisode);
  const toggleSeason = useAppStore((s) => s.toggleSeason);
  const setShowStatus = useAppStore((s) => s.setShowStatus);
  const removeShow = useAppStore((s) => s.removeShow);

  // Pending confirmation prompts. skipPrompt: the user tapped an
  // unwatched episode that has unwatched episodes before it — ask
  // whether to also mark those. rewatchPrompt: the user tapped an
  // episode that's already watched — ask whether to watch it again
  // (bumping its count) or remove it from watched entirely.
  const [skipPrompt, setSkipPrompt] = useState<{ season: number; episode: number } | null>(null);
  const [rewatchPrompt, setRewatchPrompt] = useState<{ season: number; episode: number } | null>(
    null
  );

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

  /** Applies a computed watchedEpisodes map, handling the preview-vs-
   * tracked branch that all three episode-watch actions share. */
  function commitWatchedEpisodes(watchedEpisodes: Record<string, number>) {
    if (isPreview) {
      const newShow = { ...show!, status: 'watching' as const, watchedEpisodes };
      addShow(newShow);
      setSelectedShow(newShow.id);
    }
    syncToDrive();
  }

  /** Tapping an episode's checkmark. Decides which prompt (if any) to
   * show rather than toggling immediately:
   *  - already watched → ask rewatch vs. remove
   *  - not watched, but earlier episodes are still unwatched → ask
   *    "just this one" vs. "mark everything before it too"
   *  - otherwise → just mark it watched, no prompt needed */
  function handleEpisodeCheckboxClick(season: number, episode: number) {
    if (isEpisodeWatched(show!, season, episode)) {
      setRewatchPrompt({ season, episode });
      return;
    }
    if (hasUnwatchedEpisodesBefore(show!, season, episode)) {
      setSkipPrompt({ season, episode });
      return;
    }
    if (isPreview) {
      commitWatchedEpisodes(toggleEpisodeWatched(show!, season, episode));
    } else {
      toggleEpisode(show!.id, season, episode);
      syncToDrive();
    }
  }

  function handleConfirmJustThisEpisode() {
    if (!skipPrompt) return;
    const { season, episode } = skipPrompt;
    if (isPreview) {
      commitWatchedEpisodes(toggleEpisodeWatched(show!, season, episode));
    } else {
      toggleEpisode(show!.id, season, episode);
      syncToDrive();
    }
    setSkipPrompt(null);
  }

  function handleConfirmMarkAllPrior() {
    if (!skipPrompt) return;
    const { season, episode } = skipPrompt;
    if (isPreview) {
      commitWatchedEpisodes(markEpisodeAndPriorWatched(show!, season, episode));
    } else {
      markPriorEpisodesWatched(show!.id, season, episode);
      syncToDrive();
    }
    setSkipPrompt(null);
  }

  function handleConfirmRewatch() {
    if (!rewatchPrompt) return;
    const { season, episode } = rewatchPrompt;
    if (isPreview) {
      commitWatchedEpisodes(incrementEpisodeWatchCount(show!, season, episode));
    } else {
      rewatchEpisodeAction(show!.id, season, episode);
      syncToDrive();
    }
    setRewatchPrompt(null);
  }

  function handleConfirmRemoveWatch() {
    if (!rewatchPrompt) return;
    const { season, episode } = rewatchPrompt;
    if (isPreview) {
      commitWatchedEpisodes(toggleEpisodeWatched(show!, season, episode));
    } else {
      // toggleEpisode removes it entirely (count → 0) since we already
      // know it's currently watched.
      toggleEpisode(show!.id, season, episode);
      syncToDrive();
    }
    setRewatchPrompt(null);
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
        <div className="sticky top-0 flex items-center gap-2 border-b border-ink-800 bg-ink-950/95 py-1.5 pl-1 pr-4 backdrop-blur">
          <button
            onClick={handleClose}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-xl text-ink-300 transition-colors active:bg-ink-800/60 hover:text-ink-100"
            aria-label="Back"
          >
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
                onEpisodeCheckboxClick={handleEpisodeCheckboxClick}
                onToggleSeason={handleToggleSeason}
              />
            ))}
          </div>

          {!isPreview && (
            <button
              onClick={handleRemove}
              className="mt-8 min-h-12 w-full rounded-lg border border-ink-800 py-2 text-xs font-medium text-red-400 hover:border-red-400"
            >
              Remove from tracker
            </button>
          )}
        </div>
      </div>

      {skipPrompt && (
        <ConfirmDialog
          title="Earlier episodes aren't marked watched"
          message={`You haven't marked everything before S${skipPrompt.season}E${skipPrompt.episode} as watched. Mark just this episode, or everything before it too?`}
          onDismiss={() => setSkipPrompt(null)}
          actions={[
            {
              label: 'Mark all previous episodes too',
              onClick: handleConfirmMarkAllPrior,
              variant: 'primary',
            },
            {
              label: 'Just this episode',
              onClick: handleConfirmJustThisEpisode,
              variant: 'neutral',
            },
          ]}
        />
      )}

      {rewatchPrompt && (
        <ConfirmDialog
          title="Already watched"
          message={`S${rewatchPrompt.season}E${rewatchPrompt.episode} is marked watched${
            getEpisodeWatchCount(show, rewatchPrompt.season, rewatchPrompt.episode) > 1
              ? ` (${getEpisodeWatchCount(show, rewatchPrompt.season, rewatchPrompt.episode)}×)`
              : ''
          }. Watch it again, or remove it from watched?`}
          onDismiss={() => setRewatchPrompt(null)}
          actions={[
            { label: 'Watch again', onClick: handleConfirmRewatch, variant: 'primary' },
            {
              label: 'Remove from watched',
              onClick: handleConfirmRemoveWatch,
              variant: 'danger',
            },
          ]}
        />
      )}
    </div>
  );
}
