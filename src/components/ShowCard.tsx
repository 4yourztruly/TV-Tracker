import { useEffect } from 'react';
import type { TrackedShow } from '../types/show';
import {
  getNextEpisode,
  getEpisodesLeft,
  hasWatchedAllKnownEpisodes,
  isShowUpToDate,
} from '../utils/progress';
import { useAppStore } from '../store/store';
import { syncToDrive } from '../store/sync';
import { getSeasonEpisodes, getShowDetails } from '../api/search';

interface Props {
  show: TrackedShow;
}

export function ShowCard({ show }: Props) {
  const setSelectedShow = useAppStore((s) => s.setSelectedShow);
  const markNextEpisodeWatched = useAppStore((s) => s.markNextEpisodeWatched);
  const cacheSeasonEpisodes = useAppStore((s) => s.cacheSeasonEpisodes);
  const updateSeriesStatus = useAppStore((s) => s.updateSeriesStatus);

  const next = getNextEpisode(show);
  const left = getEpisodesLeft(show);
  const upToDate = isShowUpToDate(show);
  const finishedLabel = upToDate ? 'Up to date' : 'Completed';
  const caughtUpLabel = upToDate ? 'Up to date' : 'Caught up';
  const nextEpisodeTitle = next
    ? show.seasons
        .find((season) => season.season === next.season)
        ?.episodes?.find((episode) => episode.episode === next.episode)?.title
    : null;

  useEffect(() => {
    const season = next ? show.seasons.find((seasonInfo) => seasonInfo.season === next.season) : null;
    if (!next || season?.episodes) return;

    let cancelled = false;
    getSeasonEpisodes(show.source, show.sourceId, next.season)
      .then((episodes) => {
        if (!cancelled) cacheSeasonEpisodes(show.id, next.season, episodes);
      })
      .catch((err) => {
        console.error('Failed to load card episode title:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheSeasonEpisodes, next, show.id, show.seasons, show.source, show.sourceId]);

  useEffect(() => {
    const needsStatusForDisplay = show.status === 'completed' || hasWatchedAllKnownEpisodes(show);
    if (show.seriesStatus === 'ongoing' || show.seriesStatusVersion === 2 || !needsStatusForDisplay) {
      return;
    }

    let cancelled = false;
    getShowDetails(show.source, show.sourceId)
      .then((details) => {
        if (cancelled) return;
        updateSeriesStatus(show.id, details.seriesStatus);
        syncToDrive();
      })
      .catch((err) => {
        console.error('Failed to refresh series status:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [show, updateSeriesStatus]);

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation(); // don't also open the detail view
    markNextEpisodeWatched(show.id);
    syncToDrive();
  }

  return (
    <div
      onClick={() => setSelectedShow(show.id)}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 p-3.5 transition-colors hover:border-ink-700 active:bg-ink-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500"
    >
      {show.posterUrl ? (
        <img
          src={show.posterUrl}
          alt=""
          className="h-20 w-14 flex-shrink-0 rounded-md object-cover bg-ink-800"
        />
      ) : (
        <div className="h-20 w-14 flex-shrink-0 rounded-md bg-ink-800" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-100">{show.title}</p>
        <div className="mt-0.5">
          {show.status === 'completed' ? (
            <span
              className={`text-xs font-medium ${upToDate ? 'text-ok-500' : 'text-purple-400'}`}
            >
              {finishedLabel}
            </span>
          ) : next ? (
            <>
              <div className="flex items-center text-sm text-ink-300">
                <span className="font-semibold">S{next.season}</span>
                <span className="mx-1.5 h-3.5 w-px bg-ink-700" aria-hidden="true" />
                <span className="font-semibold">E{next.episode}</span>
                {left != null && left > 0 && (
                  <span className="ml-1.5 flex-shrink-0 font-normal text-ink-400">+{left}</span>
                )}
              </div>
              {nextEpisodeTitle && (
                <p className="mt-0.5 truncate text-xs text-ink-500">{nextEpisodeTitle}</p>
              )}
            </>
          ) : (
            <span className={`text-xs ${upToDate ? 'text-ok-500' : 'text-purple-400'}`}>
              {caughtUpLabel}
            </span>
          )}
        </div>
      </div>

      {next && (
        <button
          onClick={handleCheck}
          aria-label="Mark episode watched"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-ink-600 text-ink-400 transition-colors hover:border-signal-500 hover:text-signal-500 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M4 12.5L9.5 18L20 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
