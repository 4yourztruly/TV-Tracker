import { useEffect, useState } from "react";
import type { TrackedShow } from "../types/show";
import {
  getNextEpisode,
  getEpisodesLeft,
  hasWatchedAllKnownEpisodes,
  isShowUpToDate,
} from "../utils/progress";
import { useAppStore } from "../store/store";
import { syncToDrive } from "../store/sync";
import { getSeasonEpisodes, getShowDetails } from "../api/search";

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
  const finishedLabel = upToDate ? "Up to date" : "Completed";
  const caughtUpLabel = upToDate ? "Up to date" : "Caught up";
  const nextEpisodeTitle = next
    ? show.seasons
        .find((season) => season.season === next.season)
        ?.episodes?.find((episode) => episode.episode === next.episode)?.title
    : null;

  useEffect(() => {
    const season = next
      ? show.seasons.find((seasonInfo) => seasonInfo.season === next.season)
      : null;
    if (!next || season?.episodes) return;

    let cancelled = false;
    getSeasonEpisodes(show.source, show.sourceId, next.season)
      .then((episodes) => {
        if (!cancelled) cacheSeasonEpisodes(show.id, next.season, episodes);
      })
      .catch((err) => {
        console.error("Failed to load card episode title:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [
    cacheSeasonEpisodes,
    next,
    show.id,
    show.seasons,
    show.source,
    show.sourceId,
  ]);

  useEffect(() => {
    const needsStatusForDisplay =
      show.status === "completed" || hasWatchedAllKnownEpisodes(show);
    if (
      show.seriesStatus === "ongoing" ||
      show.seriesStatusVersion === 2 ||
      !needsStatusForDisplay
    ) {
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
        console.error("Failed to refresh series status:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [show, updateSeriesStatus]);

  // True while the green "watched" wipe is sweeping across the card.
  // The checkmark button is disabled for the duration so a second tap
  // can't queue up another mark-watched while the first is still
  // playing out.
  const [isWiping, setIsWiping] = useState(false);
  // Bumped on every tap so the wipe overlay below can be re-keyed and
  // restart its CSS animation from scratch, even though the button
  // itself never unmounts (it keeps showing whatever the new "next
  // episode" is after the click goes through).
  const [wipeKey, setWipeKey] = useState(0);

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation(); // don't also open the detail view
    if (isWiping) return; // ignore taps until the current wipe finishes
    markNextEpisodeWatched(show.id);
    syncToDrive();
    setWipeKey((k) => k + 1);
    setIsWiping(true);
  }

  return (
    <div
      onClick={() => setSelectedShow(show.id)}
      role="button"
      tabIndex={0}
      className="relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-ink-800 bg-ink-900 p-3.5 transition-colors hover:border-ink-700 active:bg-ink-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500"
    >
      {isWiping && (
        <span
          key={wipeKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 origin-left bg-ok-500"
          style={{ animation: 'card-wipe 0.5s ease' }}
          onAnimationEnd={() => setIsWiping(false)}
        />
      )}
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
        <p className="truncate text-sm font-semibold text-ink-100">
          {show.title}
        </p>
        <div className="mt-0.5">
          {show.status === "completed" ? (
            <span
              className={`text-xs font-medium ${upToDate ? "text-ok-500" : "text-purple-400"}`}
            >
              {finishedLabel}
            </span>
          ) : next ? (
            <>
              <div className="flex items-center text-sm text-ink-300">
                <span className="font-semibold">S{next.season}</span>
                <span
                  className="mx-1.5 h-3.5 w-px bg-ink-700"
                  aria-hidden="true"
                />
                <span className="font-semibold">E{next.episode}</span>
                {left != null && left > 0 && (
                  <span className="ml-1.5 flex-shrink-0 font-normal text-ink-400">
                    +{left}
                  </span>
                )}
              </div>
              {nextEpisodeTitle && (
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {nextEpisodeTitle}
                </p>
              )}
            </>
          ) : (
            <span
              className={`text-xs ${upToDate ? "text-ok-500" : "text-purple-400"}`}
            >
              {caughtUpLabel}
            </span>
          )}
        </div>
      </div>

      {next && (
        <button
          onClick={handleCheck}
          disabled={isWiping}
          aria-label="Mark episode watched"
          aria-disabled={isWiping}
          className="relative z-20 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white transition-colors active:scale-95 disabled:pointer-events-none"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-ink-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path
              d="M4 12.5L9.5 18L20 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
