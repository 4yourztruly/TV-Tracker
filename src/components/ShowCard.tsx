import { useEffect, useRef, useState } from "react";
import type { TrackedShow } from "../types/show";
import { CURRENT_EPISODES_VERSION } from "../types/show";
import {
  getNextEpisode,
  getLastWatchedEpisode,
  getEpisodesLeft,
  hasWatchedAllKnownEpisodes,
  isShowUpToDate,
} from "../utils/progress";
import { useAppStore } from "../store/store";
import { syncToDrive } from "../store/sync";
import { getSeasonEpisodes, getShowDetails } from "../api/search";

interface Props {
  show: TrackedShow;
  /** Called once this card's async data (next-episode title, poster)
   * has settled, so a parent can hold a loading spinner over the whole
   * list until every card is ready instead of cards popping in one at
   * a time. */
  onReady?: () => void;
}

export function ShowCard({ show, onReady }: Props) {
  const setSelectedShow = useAppStore((s) => s.setSelectedShow);
  const markNextEpisodeWatched = useAppStore((s) => s.markNextEpisodeWatched);
  const unwatchLastEpisode = useAppStore((s) => s.unwatchLastEpisode);
  const cacheSeasonEpisodes = useAppStore((s) => s.cacheSeasonEpisodes);
  const updateSeriesStatus = useAppStore((s) => s.updateSeriesStatus);
  const backfillGenres = useAppStore((s) => s.backfillGenres);

  const next = getNextEpisode(show);
  const left = getEpisodesLeft(show);
  const upToDate = isShowUpToDate(show);
  const finishedLabel = upToDate ? "Up to date" : "Completed";
  const caughtUpLabel = upToDate ? "Up to date" : "Caught up";
  const nextEpisodeInfo = next
    ? show.seasons
        .find((season) => season.season === next.season)
        ?.episodes?.find((episode) => episode.episode === next.episode)
    : null;
  const nextEpisodeTitle = nextEpisodeInfo?.title;

  // TMDB's "finale" episode_type marks the last episode of ANY season,
  // not just the show's last one — so a series finale is a finale
  // that also falls in the show's highest known season, on a show
  // that's actually done. Everything else with that type is just a
  // season finale. Jikan-sourced episodes never have episodeType, so
  // anime shows never show this badge.
  const lastSeasonNumber =
    show.seasons.length > 0 ? Math.max(...show.seasons.map((s) => s.season)) : null;
  // TMDB doesn't tag premieres the way it tags finales (episode 1 of
  // season 2 comes back as plain "standard"), but "first episode of a
  // season past the first" is trivially derivable from the episode
  // numbers we already have, no episodeType needed — so this also
  // works for Jikan/anime, unlike the finale/mid-season badges.
  const episodeTagLabel =
    nextEpisodeInfo?.episodeType === 'finale'
      ? next?.season === lastSeasonNumber && show.seriesStatus === 'ended'
        ? 'Series Finale'
        : 'Season Finale'
      : nextEpisodeInfo?.episodeType === 'mid_season'
        ? 'Mid-Season Finale'
        : next && next.episode === 1 && next.season > 1
          ? 'Season Premiere'
          : null;

  // A season's cache only counts as usable if it's also on the current
  // episodesVersion — otherwise it predates a field (e.g. episodeType)
  // this component now depends on, and needs a silent one-time refetch
  // rather than permanently rendering without it. See CURRENT_EPISODES_VERSION.
  function seasonCacheIsFresh(seasonInfo: TrackedShow['seasons'][number] | null | undefined) {
    return !!seasonInfo?.episodes && seasonInfo.episodesVersion === CURRENT_EPISODES_VERSION;
  }

  const seasonAlreadyCached = next
    ? seasonCacheIsFresh(show.seasons.find((seasonInfo) => seasonInfo.season === next.season))
    : true;
  const [titleReady, setTitleReady] = useState(seasonAlreadyCached);
  const [posterReady, setPosterReady] = useState(!show.posterUrl);

  useEffect(() => {
    const season = next
      ? show.seasons.find((seasonInfo) => seasonInfo.season === next.season)
      : null;
    if (!next || seasonCacheIsFresh(season)) {
      setTitleReady(true);
      return;
    }

    let cancelled = false;
    getSeasonEpisodes(show.source, show.sourceId, next.season)
      .then((episodes) => {
        if (!cancelled) cacheSeasonEpisodes(show.id, next.season, episodes);
      })
      .catch((err) => {
        console.error("Failed to load card episode title:", err);
      })
      .finally(() => {
        if (!cancelled) setTitleReady(true);
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
    if (titleReady && posterReady) onReady?.();
  }, [titleReady, posterReady, onReady]);

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

  // One-time backfill for shows tracked before `genres` existed on
  // TrackedShow. `undefined` means "never checked"; backfillGenres
  // always sets at least `[]`, so a show with genuinely no genres
  // from its source is marked "checked" and this doesn't refetch it
  // forever.
  useEffect(() => {
    if (show.genres !== undefined) return;

    let cancelled = false;
    getShowDetails(show.source, show.sourceId)
      .then((details) => {
        if (cancelled) return;
        backfillGenres(show.id, details.genres ?? []);
        syncToDrive();
      })
      .catch((err) => {
        console.error("Failed to backfill genres:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [show.id, show.source, show.sourceId, show.genres, backfillGenres]);

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
    if (isWiping || isUnwiping) return; // ignore taps until the current wipe finishes
    markNextEpisodeWatched(show.id);
    syncToDrive();
    setWipeKey((k) => k + 1);
    setIsWiping(true);
  }

  // Swipe-right-to-unwatch: dragging the card's foreground layer to the
  // right reveals a red "Unwatch" panel underneath it; releasing past
  // the halfway point commits unwatching whatever the latest watched
  // episode is (see getLastWatchedEpisode). Only enabled when there's
  // something to undo.
  const canUnwatch = getLastWatchedEpisode(show) != null;
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    locked: boolean;
  } | null>(null);
  // Set once a drag locks in, so the click that a touchend/mouseup
  // synthesizes afterward doesn't also open the detail view. Consumed
  // (reset) by the very next click.
  const wasDraggedRef = useRef(false);
  const [dragX, setDragXState] = useState(0);
  // Mirrors `dragX` synchronously so handlePointerUp always reads the
  // distance as of the actual release, not whatever the last-committed
  // render happened to be — state updates from a fast run of
  // pointermove events can lag a render behind.
  const dragXRef = useRef(0);
  function setDragX(value: number) {
    dragXRef.current = value;
    setDragXState(value);
  }
  const [isDragging, setIsDragging] = useState(false);
  const [isUnwiping, setIsUnwiping] = useState(false);
  const [unwipeKey, setUnwipeKey] = useState(0);

  function handlePointerDown(e: React.PointerEvent) {
    if (!canUnwatch) return;
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      locked: false,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.locked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      // Only rightward, clearly-horizontal drags count as this gesture —
      // requiring dx to clearly dominate dy (not just barely) keeps the
      // natural wobble in an intended vertical list scroll from being
      // mistaken for a swipe. Anything else is left alone entirely.
      if (dx <= 0 || Math.abs(dx) <= Math.abs(dy) * 1.5) {
        dragStateRef.current = null;
        return;
      }
      drag.locked = true;
      wasDraggedRef.current = true;
      setIsDragging(true);
    }
    const width = cardRef.current?.offsetWidth ?? 0;
    setDragX(Math.max(0, Math.min(dx, width)));
  }

  // A cancel means the browser reclaimed the gesture for its own
  // native handling (typically: the list scrolled enough that it
  // decided this was a scroll, not a drag) — not a deliberate release.
  // Treating it like a normal release risked an interrupted scroll
  // "slipping" into committing the unwatch. Always just snap back.
  function handlePointerCancel() {
    dragStateRef.current = null;
    setIsDragging(false);
    setDragX(0);
  }

  function handlePointerUp() {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    if (!drag?.locked) {
      setDragX(0);
      return;
    }
    setIsDragging(false);
    const width = cardRef.current?.offsetWidth ?? 0;
    if (dragXRef.current > width * 0.5) {
      unwatchLastEpisode(show.id);
      syncToDrive();
      setUnwipeKey((k) => k + 1);
      setIsUnwiping(true);
    }
    setDragX(0);
  }

  function handleCardClick() {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    setSelectedShow(show.id);
  }

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {canUnwatch && dragX > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-nowrap bg-red-600 pl-6 text-sm font-semibold text-white"
          style={{ width: dragX }}
        >
          Unwatch
        </div>
      )}
      {isWiping && (
        <span
          key={wipeKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ok-500 text-sm font-semibold text-white"
          style={{ animation: 'card-wipe 0.5s ease' }}
          onAnimationEnd={() => setIsWiping(false)}
        >
          Watched
        </span>
      )}
      {isUnwiping && (
        <span
          key={unwipeKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-red-600 text-sm font-semibold text-white"
          style={{ animation: 'card-wipe 0.5s ease' }}
          onAnimationEnd={() => setIsUnwiping(false)}
        >
          Unwatched
        </span>
      )}

      <div
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease",
        }}
        className="flex cursor-pointer items-stretch gap-3 border border-ink-800 bg-ink-900 transition-colors hover:border-ink-700 active:bg-ink-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500"
      >
        {show.posterUrl ? (
          <img
            src={show.posterUrl}
            alt=""
            className="h-full w-24 flex-shrink-0 object-cover bg-ink-800"
            onLoad={() => setPosterReady(true)}
            onError={() => setPosterReady(true)}
          />
        ) : (
          <div className="h-full w-24 flex-shrink-0 bg-ink-800" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-3.5">
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
                  {episodeTagLabel && (
                    <span
                      className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        episodeTagLabel === 'Season Premiere'
                          ? 'bg-white/20 text-white'
                          : 'bg-signal-500/20 text-signal-500'
                      }`}
                    >
                      {episodeTagLabel}
                    </span>
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
              disabled={isWiping || isUnwiping}
              aria-label="Mark episode watched"
              aria-disabled={isWiping || isUnwiping}
              className={`relative z-20 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 disabled:pointer-events-none ${isWiping || isUnwiping ? "bg-transparent" : "bg-white"}`}
            >
              {/* Hidden while either wipe plays so the whole button
                  (circle and checkmark) disappears together during the
                  disabled window. */}
              {!isWiping && !isUnwiping && (
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
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
