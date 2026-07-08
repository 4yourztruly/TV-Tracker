import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useAppStore } from '../store/store';
import { SeasonAccordion } from '../components/SeasonAccordion';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ImageLightbox } from '../components/ImageLightbox';
import { RelatedShows } from '../components/RelatedShows';
import { Spinner } from '../components/Spinner';
import { getImdbRating } from '../api/omdb';
import { getShowDetails, getRelatedShows } from '../api/search';
import { buildTrackedShow } from '../utils/buildTrackedShow';
import { formatYearRange } from '../utils/formatYearRange';
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
import type { SearchResult, WatchStatus } from '../types/show';

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
  const backfillGenres = useAppStore((s) => s.backfillGenres);
  const backfillImdbRating = useAppStore((s) => s.backfillImdbRating);
  const backfillAgeRating = useAppStore((s) => s.backfillAgeRating);
  const backfillBackdrops = useAppStore((s) => s.backfillBackdrops);
  const backfillYears = useAppStore((s) => s.backfillYears);
  const backfillRelatedShows = useAppStore((s) => s.backfillRelatedShows);

  // Deep-link from the Home screen's Watch History: which episode (if
  // any) to auto-expand/scroll to on open. Captured once on mount
  // (lazy initializer) rather than read live, so it can't change out
  // from under this screen mid-view; the store's copy is cleared right
  // after so it doesn't affect any later, unrelated open.
  const [focusEpisode] = useState(() => useAppStore.getState().pendingEpisodeFocus);
  useEffect(() => {
    if (focusEpisode) useAppStore.getState().setPendingEpisodeFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pending confirmation prompts. skipPrompt: the user tapped an
  // unwatched episode that has unwatched episodes before it — ask
  // whether to also mark those. rewatchPrompt: the user tapped an
  // episode that's already watched — ask whether to watch it again
  // (bumping its count) or remove it from watched entirely.
  const [skipPrompt, setSkipPrompt] = useState<{ season: number; episode: number } | null>(null);
  const [rewatchPrompt, setRewatchPrompt] = useState<{ season: number; episode: number } | null>(
    null
  );
  // Confirms permanently removing the show from the tracker. Uses the
  // same styled ConfirmDialog as the episode prompts instead of the
  // native browser confirm(), which looks jarringly out of place.
  const [showRemovePrompt, setShowRemovePrompt] = useState(false);

  // Which backdrop image (if any) the full-screen photo viewer is
  // open on — index into show.backdropUrls, null when closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Swipe-from-the-left-edge-to-go-back: a drag starting within
  // EDGE_WIDTH px of the screen's left edge drags the whole sheet
  // along with the finger; releasing past CLOSE_THRESHOLD_RATIO of the
  // sheet's width finishes the close, otherwise it springs back. A
  // vertical-dominant drag (i.e. the user is scrolling the content, not
  // swiping back) bails out immediately without touching scroll.
  const EDGE_WIDTH = 24;
  const CLOSE_THRESHOLD_RATIO = 0.3;
  const sheetRef = useRef<HTMLDivElement>(null);
  // The scrollable body (bio + season list) — its native scrolling is
  // locked for the duration of a locked-in edge-swipe so the browser
  // can't reclaim the touch mid-drag to scroll it (which used to fire
  // a pointercancel that got misread as a deliberate release).
  const contentScrollRef = useRef<HTMLDivElement>(null);
  function setContentScrollLocked(locked: boolean) {
    const el = contentScrollRef.current;
    if (el) el.style.overflowY = locked ? 'hidden' : '';
  }
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    locked: boolean;
  } | null>(null);
  const [dragX, setDragXState] = useState(0);
  // Mirrors `dragX` synchronously. handlePointerUp reads this instead
  // of the state value directly — state updates from a fast flurry of
  // pointermove events can commit a render behind, so reading state at
  // release time risked acting on a stale distance (closing/springing
  // back based on where the drag *was* a moment ago, not where it
  // actually ended).
  const dragXRef = useRef(0);
  function setDragX(value: number) {
    dragXRef.current = value;
    setDragXState(value);
  }
  const [isDragging, setIsDragging] = useState(false);

  const trackedShow = shows.find((s) => s.id === selectedShowId);
  // Preview mode: viewing a search result's details before it's been
  // added to the tracker. Kept out of the main `shows` list/Drive sync
  // until the user explicitly adds it.
  const isPreview = !trackedShow && !!previewShow;
  const show = trackedShow ?? previewShow;

  // The show's data (bio, episode count, seasons, genres, IMDb rating,
  // ...) is all loaded synchronously by the time this screen mounts —
  // preview shows are built fresh from the API before being shown, and
  // tracked shows already carry it from when they were added. The
  // whole body waits behind a spinner only for the rare legacy case
  // below (a show tracked before one of these fields was cached),
  // rather than ever popping fields in late on a normal view.
  const imdbRating = show?.imdbRating ?? null;
  // Separate from `show.imdbRating` itself: a transient OMDb failure
  // (rate limit, network) deliberately isn't persisted (see the
  // backfill effect below), so waiting on `imdbRating !== undefined`
  // alone would spin forever during an outage. This flips once the
  // one backfill attempt below has settled, success or not.
  const [imdbCheckAttempted, setImdbCheckAttempted] = useState(false);
  const imdbReady = show == null || show.imdbRating !== undefined || imdbCheckAttempted;

  // Same idea, for the genres/ageRating/backdropUrls/startYear backfill
  // below. Without this, a legacy show whose genres/ageRating were
  // already backfilled in an earlier session (before startYear
  // existed) would show those instantly but have the date visibly pop
  // in a beat later once its one-time backfill resolves — inconsistent
  // with everything else, which either shows immediately or waits
  // behind the spinner. Gating all of it the same way means it always
  // appears together.
  const [metaCheckAttempted, setMetaCheckAttempted] = useState(false);
  const metaReady =
    show == null ||
    (show.genres !== undefined &&
      show.ageRating !== undefined &&
      show.backdropUrls !== undefined &&
      show.startYear !== undefined) ||
    metaCheckAttempted;
  const contentReady = imdbReady && metaReady;

  // One-time backfill for a tracked show that predates `genres` or
  // `imdbRating` existing on TrackedShow. `undefined` means "never
  // checked"; both backfill actions always set a real value (even `[]`
  // / `null`) so a show with genuinely nothing to report is marked
  // "checked" and isn't re-fetched forever. Doesn't apply to preview
  // shows — those are always built fresh from the API already.
  //
  // genres/ageRating/backdropUrls/startYear/endYear all come from the
  // exact same getShowDetails response — one shared fetch backfills
  // whichever of them a legacy show is still missing, rather than each
  // firing its own separate (and identical) request in parallel.
  useEffect(() => {
    if (
      !trackedShow ||
      (trackedShow.genres !== undefined &&
        trackedShow.ageRating !== undefined &&
        trackedShow.backdropUrls !== undefined &&
        trackedShow.startYear !== undefined)
    ) {
      return;
    }
    let cancelled = false;
    getShowDetails(trackedShow.source, trackedShow.sourceId)
      .then((details) => {
        if (cancelled) return;
        backfillGenres(trackedShow.id, details.genres ?? []);
        backfillAgeRating(trackedShow.id, details.ageRating ?? null);
        backfillBackdrops(trackedShow.id, details.backdropUrls ?? []);
        backfillYears(trackedShow.id, details.startYear ?? null, details.endYear ?? null);
        syncToDrive();
      })
      .catch((err) => {
        console.error('Failed to backfill show metadata:', err);
      })
      .finally(() => {
        if (!cancelled) setMetaCheckAttempted(true);
      });
    return () => {
      cancelled = true;
    };
  }, [trackedShow, backfillGenres, backfillAgeRating, backfillBackdrops, backfillYears]);

  useEffect(() => {
    if (!trackedShow || trackedShow.imdbRating !== undefined) return;
    let cancelled = false;
    getImdbRating(trackedShow.title).then((rating) => {
      if (cancelled) return;
      // Only a definite answer (found or confirmed no match) gets
      // persisted; a transient failure (rating === undefined) is left
      // unset so it's retried next time this show is opened.
      if (rating !== undefined) {
        backfillImdbRating(trackedShow.id, rating);
        syncToDrive();
      }
      setImdbCheckAttempted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [trackedShow, backfillImdbRating]);

  useEffect(() => {
    if (!trackedShow || trackedShow.relatedShows !== undefined) return;
    // TMDB's related-shows query needs genres — wait for those to
    // have settled (see the genres backfill effect above) instead of
    // firing with an empty genre list and permanently caching an
    // empty result. Not a concern on the Jikan path, which doesn't
    // use genres at all (see getRelatedShows).
    if (trackedShow.source === 'tmdb' && trackedShow.genres === undefined) return;
    let cancelled = false;
    getRelatedShows(trackedShow.source, trackedShow.sourceId, trackedShow.genres)
      .then((related) => {
        if (cancelled) return;
        backfillRelatedShows(trackedShow.id, related);
        syncToDrive();
      })
      .catch((err) => {
        console.error('Failed to fetch related shows:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [trackedShow, backfillRelatedShows]);

  // Which related-show tile (if any) is currently being opened, keyed
  // as `${source}-${sourceId}` — shows a spinner on just that tile
  // while its full details are fetched to build the preview.
  const [openingRelatedKey, setOpeningRelatedKey] = useState<string | null>(null);

  async function handleOpenRelatedShow(result: SearchResult) {
    const existing = shows.find(
      (s) => s.source === result.source && s.sourceId === result.sourceId
    );
    if (existing) {
      setSelectedShow(existing.id);
      return;
    }
    const key = `${result.source}-${result.sourceId}`;
    setOpeningRelatedKey(key);
    try {
      const built = await buildTrackedShow(result);
      // `show` resolves to trackedShow ?? previewShow — since we're
      // currently viewing a *tracked* show, selectedShowId is still
      // set to it, so setPreviewShow alone would do nothing visible.
      // Clear it so the screen actually falls through to the new preview.
      setPreviewShow(built);
      setSelectedShow(null);
    } catch (err) {
      console.error('Failed to load related show details:', err);
    } finally {
      setOpeningRelatedKey(null);
    }
  }

  if (!show) return null;

  const yearRange = formatYearRange(show.startYear, show.endYear, show.seriesStatus);

  function handleClose() {
    setSelectedShow(null);
    setPreviewShow(null);
  }

  function handleEdgePointerDown(e: React.PointerEvent) {
    if (e.clientX > EDGE_WIDTH) return; // only from the very left edge
    if (skipPrompt || rewatchPrompt || showRemovePrompt || lightboxIndex !== null) return; // a dialog is up
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      locked: false,
    };
  }

  function handleEdgePointerMove(e: React.PointerEvent) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.locked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      // Require a clearly horizontal drag (not just barely more
      // horizontal than vertical) before committing to the back-swipe —
      // otherwise the natural wobble in an intended vertical scroll can
      // get mistaken for it and yank the sheet sideways.
      if (dx <= 0 || Math.abs(dx) <= Math.abs(dy) * 1.5) {
        dragStateRef.current = null; // vertical scroll, not a back-swipe
        return;
      }
      drag.locked = true;
      setIsDragging(true);
      // Lock the content's own scrolling for the rest of this gesture —
      // otherwise the browser can reclaim the touch mid-drag to scroll
      // it, which used to fire a pointercancel that got misread as a
      // deliberate release.
      setContentScrollLocked(true);
    }
    const width = sheetRef.current?.offsetWidth ?? window.innerWidth;
    setDragX(Math.max(0, Math.min(dx, width)));
  }

  // A cancel means the browser is taking the gesture away from us —
  // not the user deliberately releasing. Treating it like a normal
  // release meant an interrupted gesture could "slip" into closing the
  // sheet even though the user never let go past the threshold. Always
  // just snap back instead.
  function handleEdgePointerCancel() {
    dragStateRef.current = null;
    setIsDragging(false);
    setContentScrollLocked(false);
    setDragX(0);
  }

  function handleEdgePointerUp() {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    if (!drag?.locked) {
      setDragX(0);
      return;
    }
    setContentScrollLocked(false);
    setIsDragging(false);
    const width = sheetRef.current?.offsetWidth ?? window.innerWidth;
    if (dragXRef.current > width * CLOSE_THRESHOLD_RATIO) {
      setDragX(width);
      setTimeout(handleClose, 150);
    } else {
      setDragX(0);
    }
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
    // Switch to the now-tracked show in place, same as the other
    // preview-to-tracked actions above (commitWatchedEpisodes,
    // handleToggleSeason) — don't close the whole sheet. Closing here
    // used to only ever bounce back to Search, which was fine, but a
    // preview reached via another show's Related Shows would incorrectly
    // close all the way out to Home instead of staying on this show.
    setSelectedShow(show!.id);
    syncToDrive();
  }

  function handleStatusChange(status: WatchStatus) {
    setShowStatus(show!.id, status);
    syncToDrive();
  }

  function handleRemove() {
    setShowRemovePrompt(true);
  }

  function handleConfirmRemove() {
    removeShow(show!.id);
    syncToDrive();
    setShowRemovePrompt(false);
    handleClose();
  }

  return (
    <div
      className="fixed inset-0 z-20 flex justify-center bg-black/40"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={handleEdgePointerDown}
      onPointerMove={handleEdgePointerMove}
      onPointerUp={handleEdgePointerUp}
      onPointerCancel={handleEdgePointerCancel}
    >
      <div
        ref={sheetRef}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease',
        }}
        className="flex h-full w-full max-w-[480px] flex-col bg-ink-950 md:border-x md:border-ink-800"
      >
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

        {!contentReady ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner size={40} />
          </div>
        ) : (
          // Keyed by show.id: this component doesn't unmount when you
          // navigate from one show to another (e.g. tapping a Related
          // Shows tile), it just re-renders with a new `show` prop —
          // so without a key here, the poster/backdrop <img> elements
          // and every SeasonAccordion just get their src/props updated
          // in place. Browsers keep showing an <img>'s previous bitmap
          // until the new one finishes loading, and SeasonAccordion's
          // own episode-list state is seeded once via useState's lazy
          // initializer, not resubscribed on prop changes — both of
          // which surfaced as "the old show's pictures" after opening
          // a related show. Keying this whole block forces a clean
          // remount (and resets scroll position) on every show switch.
          <div
            key={show.id}
            ref={contentScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          >
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
                  {yearRange ? ` · ${yearRange}` : ''}
                </p>
                {show.episodeRuntimeMinutes != null && (
                  <p className="text-xs text-ink-400">
                    {show.episodeRuntimeMinutes} min per episode
                  </p>
                )}
                {show.genres && show.genres.length > 0 && (
                  <p className="text-xs text-ink-400">{show.genres.join(', ')}</p>
                )}
                {show.ageRating && (
                  <span className="w-fit rounded border border-ink-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-300">
                    {show.ageRating}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <h3 className="min-w-0 truncate text-base font-semibold text-ink-100">
                {show.title}
              </h3>
              {imdbRating && (
                <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold text-signal-500">
                  <Star className="h-3 w-3 fill-current" />
                  {imdbRating}
                </span>
              )}
            </div>

            {show.summary && (
              <p className="mt-1 text-sm leading-relaxed text-ink-200">{show.summary}</p>
            )}

            {show.backdropUrls && show.backdropUrls.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {show.backdropUrls.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="flex-shrink-0"
                  >
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-20 w-36 rounded-md bg-ink-800 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                Seasons
              </h3>
              {show.seasons.map((season) => (
                <SeasonAccordion
                  key={season.season}
                  show={show}
                  season={season}
                  onEpisodeCheckboxClick={handleEpisodeCheckboxClick}
                  onToggleSeason={handleToggleSeason}
                  autoExpand={focusEpisode?.season === season.season}
                  focusEpisode={
                    focusEpisode?.season === season.season ? focusEpisode.episode : undefined
                  }
                />
              ))}
            </div>

            {show.relatedShows && (
              <RelatedShows
                shows={show.relatedShows}
                openingKey={openingRelatedKey}
                onSelect={handleOpenRelatedShow}
              />
            )}

            {!isPreview && (
              <button
                onClick={handleRemove}
                className="mt-8 min-h-12 w-full rounded-lg border border-ink-800 py-2 text-xs font-medium text-red-400 hover:border-red-400"
              >
                Remove from tracker
              </button>
            )}
          </div>
        )}
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
      {showRemovePrompt && (
        <ConfirmDialog
          title="Remove show"
          message={`Remove "${show.title}" from your tracker? This can't be undone.`}
          onDismiss={() => setShowRemovePrompt(false)}
          actions={[
            { label: 'Remove from tracker', onClick: handleConfirmRemove, variant: 'danger' },
          ]}
        />
      )}

      {lightboxIndex !== null && show.backdropUrls && (
        <ImageLightbox
          images={show.backdropUrls}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
