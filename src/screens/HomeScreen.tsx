import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackedShow } from '../types/show';
import { useAppStore, type HomeSortBy } from '../store/store';
import { ShowCard } from '../components/ShowCard';
import { ShowPoster } from '../components/ShowPoster';
import { WatchHistoryItem } from '../components/WatchHistoryItem';
import { Spinner } from '../components/Spinner';
import { getImdbRating } from '../api/omdb';
import { isShowUpToDate, getLastWatchedAt, getPosterProgress } from '../utils/progress';

/** Comparator for the non-default sort options — 'default' is handled
 * separately per-section (see HomeScreen) since it means something
 * different in each one (e.g. Watching's recency order), not a single
 * shared comparator. */
function compareShows(a: TrackedShow, b: TrackedShow, sortBy: HomeSortBy): number {
  switch (sortBy) {
    case 'rating': {
      const ra = a.imdbRating ? parseFloat(a.imdbRating) : -1;
      const rb = b.imdbRating ? parseFloat(b.imdbRating) : -1;
      return rb - ra;
    }
    case 'completion':
      return getPosterProgress(b).fraction - getPosterProgress(a).fraction;
    case 'title':
      return a.title.localeCompare(b.title);
    default:
      return 0;
  }
}

const WATCH_HISTORY_PAGE_SIZE = 10;
// How close to the very bottom of the scroll container (in px) before
// loading in the next batch of older Watch History entries.
const WATCH_HISTORY_LOAD_MORE_THRESHOLD = 80;

export function HomeScreen() {
  const shows = useAppStore((s) => s.shows);
  const homeViewMode = useAppStore((s) => s.homeViewMode);
  const onlyShowWatching = useAppStore((s) => s.onlyShowWatching);
  const showWatchHistory = useAppStore((s) => s.showWatchHistory);
  const homeSortBy = useAppStore((s) => s.homeSortBy);
  const homeGenreFilter = useAppStore((s) => s.homeGenreFilter);

  // A show must have at least one of the selected genres to survive
  // this filter — applied before bucketing into sections below, so
  // Watching/Watchlist/Up to date/Completed all respect it. Watch
  // History (a chronological log, not a status bucket) is
  // deliberately left unfiltered.
  const filteredShows =
    homeGenreFilter.length > 0
      ? shows.filter((s) => s.genres?.some((g) => homeGenreFilter.includes(g)))
      : shows;

  // Sorting by rating only means something for shows whose imdbRating
  // has actually been fetched — most have it cached from being opened
  // in the detail screen at least once, but some never have been. Backs
  // those in specifically (only while "IMDb Rating" sort is selected,
  // only the currently-visible/filtered shows, and only once per show
  // per session via the ref below) rather than either leaving them
  // stuck unrated at the bottom or eagerly fetching every tracked
  // show's rating on every Home visit regardless of sort.
  const backfillImdbRating = useAppStore((s) => s.backfillImdbRating);
  const ratingBackfillAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (homeSortBy !== 'rating') return;
    const missing = filteredShows.filter(
      (s) => s.imdbRating === undefined && !ratingBackfillAttempted.current.has(s.id)
    );
    if (missing.length === 0) return;
    missing.forEach((s) => {
      ratingBackfillAttempted.current.add(s.id);
      getImdbRating(s.title).then((rating) => {
        // A transient failure (undefined) is left unset rather than
        // persisted as "no rating" — same convention as the detail
        // screen's own backfill — but is still marked attempted above
        // so a slow OMDb outage doesn't retry every render this
        // session either.
        if (rating !== undefined) backfillImdbRating(s.id, rating, 'imdb');
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeSortBy, filteredShows]);

  // Every home-screen "mark watched" tap across every show, flattened
  // into one feed and sorted newest-first (oldest last) — a separate,
  // recency-ordered view layered below the status-grouped sections
  // above (a show can appear in both, and the same show can appear
  // multiple times if several of its episodes were watched that way).
  const watchHistory = showWatchHistory
    ? shows
        .flatMap((show) => (show.watchHistory ?? []).map((entry) => ({ show, entry })))
        .sort((a, b) => b.entry.watchedAt - a.entry.watchedAt)
    : [];

  // Only the most recent WATCH_HISTORY_PAGE_SIZE entries render at
  // first; scrolling down toward the bottom loads the next batch of
  // older ones (see the load-more effect below), so a long history
  // doesn't all have to render at once.
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(WATCH_HISTORY_PAGE_SIZE);
  const visibleWatchHistory = watchHistory.slice(0, visibleHistoryCount);

  // Non-default sort options override every section's own ordering
  // with the same comparator; 'default' leaves each section exactly as
  // it was (e.g. Watching's recency order, others in insertion order).
  const sortSection = (section: TrackedShow[]) =>
    homeSortBy === 'default' ? section : [...section].sort((a, b) => compareShows(a, b, homeSortBy));

  const upToDate = sortSection(filteredShows.filter(isShowUpToDate));
  // Most-recently-watched-episode first, so watching another episode of
  // a lower show bumps it back to the top — driven by the same Watch
  // History entries as the section below, just collapsed to one row per
  // show. Unwatching removes its Watch History entry (see
  // unwatchLastEpisode), so it naturally drops back out of "just
  // watched" instead of still being prioritized. Only the default sort
  // uses this recency order — any other sort overrides it like every
  // other section.
  const watchingFiltered = filteredShows.filter((s) => s.status === 'watching' && !isShowUpToDate(s));
  const watching =
    homeSortBy === 'default'
      ? [...watchingFiltered].sort((a, b) => (getLastWatchedAt(b) ?? 0) - (getLastWatchedAt(a) ?? 0))
      : sortSection(watchingFiltered);
  const unwatched = sortSection(filteredShows.filter((s) => s.status === 'unwatched'));
  const completed = sortSection(
    filteredShows.filter((s) => s.status === 'completed' && !isShowUpToDate(s))
  );

  // Every card/poster reports in once its own async data (poster image,
  // next-episode title) has settled, so the whole list can be held
  // behind one spinner and revealed all at once instead of items
  // popping in individually.
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const markReady = useCallback((id: string) => {
    setReadyIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);
  const visibleShows = onlyShowWatching ? watching : filteredShows;

  // Safety net: a stalled network request (poor mobile connection,
  // etc.) can leave a single card's poster/title promise never
  // settling, which would otherwise hold the ENTIRE list hidden
  // behind the spinner forever. Reveal everything anyway after a
  // timeout — any card still mid-fetch just keeps loading in place
  // instead of blocking every other already-ready card.
  const [readyTimedOut, setReadyTimedOut] = useState(false);
  useEffect(() => {
    setReadyTimedOut(false);
    const timer = setTimeout(() => setReadyTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [shows]);

  const allReady = readyTimedOut || visibleShows.every((s) => readyIds.has(s.id));

  // Watch History is the last section on the page, so growing/shrinking
  // it (marking an episode watched/unwatched from the home screen)
  // never shifts anything above it — no scroll compensation needed.
  const rootRef = useRef<HTMLDivElement>(null);

  // Scrolling near the very bottom loads the next
  // WATCH_HISTORY_PAGE_SIZE older entries — standard infinite-scroll
  // pattern. Re-subscribes whenever the total count changes so the
  // handler's cap is never stale.
  useEffect(() => {
    const scrollEl = rootRef.current?.closest('.overflow-y-auto');
    if (!(scrollEl instanceof HTMLElement)) return;
    function handleScroll() {
      const el = scrollEl as HTMLElement;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > WATCH_HISTORY_LOAD_MORE_THRESHOLD) return;
      setVisibleHistoryCount((prev) => Math.min(prev + WATCH_HISTORY_PAGE_SIZE, watchHistory.length));
    }
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [watchHistory.length]);

  if (shows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
        <p className="text-sm font-medium text-ink-200">Nothing tracked yet</p>
        <p className="text-xs text-ink-400">
          Head to the Search tab to find a show or anime and add it to your list.
        </p>
      </div>
    );
  }

  const isGrid = homeViewMode === 'grid';

  if (homeGenreFilter.length > 0 && filteredShows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
        <p className="text-sm font-medium text-ink-200">No shows match this filter</p>
        <p className="text-xs text-ink-400">
          Try selecting different genres from the filter menu.
        </p>
      </div>
    );
  }

  if (onlyShowWatching && watching.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
        <p className="text-sm font-medium text-ink-200">Nothing in progress right now</p>
        <p className="text-xs text-ink-400">
          "Only show Watching" is on in Settings — turn it off to see your Watchlist and
          Completed shows.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative min-h-[50vh]">
      {!allReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-950">
          <Spinner size={40} />
        </div>
      )}
      <div
        className={`flex flex-col gap-6 px-4 py-4 ${allReady ? '' : 'invisible'}`}
      >
        {watching.length > 0 && (
          <Section title="Watching" grid={isGrid}>
            {watching.map((show) => (
              <ShowItem key={show.id} show={show} grid={isGrid} onReady={markReady} />
            ))}
          </Section>
        )}

        {unwatched.length > 0 && !onlyShowWatching && (
          <Section title="Watchlist" grid={isGrid}>
            {unwatched.map((show) => (
              <ShowItem key={show.id} show={show} grid={isGrid} onReady={markReady} />
            ))}
          </Section>
        )}

        {upToDate.length > 0 && !onlyShowWatching && (
          <Section title="Up to date" grid={isGrid}>
            {upToDate.map((show) => (
              <ShowItem key={show.id} show={show} grid={isGrid} onReady={markReady} />
            ))}
          </Section>
        )}

        {completed.length > 0 && !onlyShowWatching && (
          <Section title="Completed" grid={isGrid}>
            {completed.map((show) => (
              <ShowItem key={show.id} show={show} grid={isGrid} onReady={markReady} />
            ))}
          </Section>
        )}

        {visibleWatchHistory.length > 0 && !isGrid && (
          <Section title="Watch History" grid={false}>
            {visibleWatchHistory.map(({ show, entry }) => (
              <WatchHistoryItem
                key={`${show.id}-${entry.season}-${entry.episode}-${entry.watchedAt}`}
                show={show}
                season={entry.season}
                episode={entry.episode}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function ShowItem({
  show,
  grid,
  onReady,
}: {
  show: TrackedShow;
  grid: boolean;
  onReady: (id: string) => void;
}) {
  const handleReady = () => onReady(show.id);
  return grid ? (
    <ShowPoster show={show} onReady={handleReady} />
  ) : (
    <ShowCard show={show} onReady={handleReady} />
  );
}

function Section({
  title,
  grid,
  children,
}: {
  title: string;
  grid: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</h2>
      <div className={grid ? 'grid grid-cols-3 gap-3' : 'flex flex-col gap-2'}>{children}</div>
    </div>
  );
}
