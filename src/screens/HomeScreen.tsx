import { useCallback, useState } from 'react';
import type { TrackedShow } from '../types/show';
import { useAppStore } from '../store/store';
import { ShowCard } from '../components/ShowCard';
import { ShowPoster } from '../components/ShowPoster';
import { Spinner } from '../components/Spinner';
import { isShowUpToDate } from '../utils/progress';

export function HomeScreen() {
  const shows = useAppStore((s) => s.shows);
  const homeViewMode = useAppStore((s) => s.homeViewMode);
  const onlyShowWatching = useAppStore((s) => s.onlyShowWatching);

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
    <div className="relative min-h-[50vh]">
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
