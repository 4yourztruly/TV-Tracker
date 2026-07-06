import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackedShow } from '../types/show';
import { useAppStore } from '../store/store';
import { ShowCard } from '../components/ShowCard';
import { ShowPoster } from '../components/ShowPoster';
import { WatchHistoryItem } from '../components/WatchHistoryItem';
import { Spinner } from '../components/Spinner';
import { isShowUpToDate } from '../utils/progress';

const WATCH_HISTORY_PAGE_SIZE = 10;
// How close to the very bottom of the scroll container (in px) before
// loading in the next batch of older Watch History entries.
const WATCH_HISTORY_LOAD_MORE_THRESHOLD = 80;

export function HomeScreen() {
  const shows = useAppStore((s) => s.shows);
  const homeViewMode = useAppStore((s) => s.homeViewMode);
  const onlyShowWatching = useAppStore((s) => s.onlyShowWatching);
  const showWatchHistory = useAppStore((s) => s.showWatchHistory);

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

  const upToDate = shows.filter(isShowUpToDate);
  const watching = shows.filter((s) => s.status === 'watching' && !isShowUpToDate(s));
  const unwatched = shows.filter((s) => s.status === 'unwatched');
  const completed = shows.filter((s) => s.status === 'completed' && !isShowUpToDate(s));

  // Every card/poster reports in once its own async data (poster image,
  // next-episode title) has settled, so the whole list can be held
  // behind one spinner and revealed all at once instead of items
  // popping in individually.
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const markReady = useCallback((id: string) => {
    setReadyIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);
  const visibleShows = onlyShowWatching ? watching : shows;
  const allReady = visibleShows.every((s) => readyIds.has(s.id));

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

        {visibleWatchHistory.length > 0 && (
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
