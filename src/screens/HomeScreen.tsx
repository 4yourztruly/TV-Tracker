import type { TrackedShow } from '../types/show';
import { useAppStore } from '../store/store';
import { ShowCard } from '../components/ShowCard';
import { ShowPoster } from '../components/ShowPoster';
import { isShowUpToDate } from '../utils/progress';

export function HomeScreen() {
  const shows = useAppStore((s) => s.shows);
  const homeViewMode = useAppStore((s) => s.homeViewMode);
  const onlyShowWatching = useAppStore((s) => s.onlyShowWatching);

  const upToDate = shows.filter(isShowUpToDate);
  const watching = shows.filter((s) => s.status === 'watching' && !isShowUpToDate(s));
  const unwatched = shows.filter((s) => s.status === 'unwatched');
  const completed = shows.filter((s) => s.status === 'completed' && !isShowUpToDate(s));

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
    <div className="flex flex-col gap-6 px-4 py-4">
      {watching.length > 0 && (
        <Section title="Watching" grid={isGrid}>
          {watching.map((show) => (
            <ShowItem key={show.id} show={show} grid={isGrid} />
          ))}
        </Section>
      )}

      {unwatched.length > 0 && !onlyShowWatching && (
        <Section title="Watchlist" grid={isGrid}>
          {unwatched.map((show) => (
            <ShowItem key={show.id} show={show} grid={isGrid} />
          ))}
        </Section>
      )}

      {upToDate.length > 0 && !onlyShowWatching && (
        <Section title="Up to date" grid={isGrid}>
          {upToDate.map((show) => (
            <ShowItem key={show.id} show={show} grid={isGrid} />
          ))}
        </Section>
      )}

      {completed.length > 0 && !onlyShowWatching && (
        <Section title="Completed" grid={isGrid}>
          {completed.map((show) => (
            <ShowItem key={show.id} show={show} grid={isGrid} />
          ))}
        </Section>
      )}
    </div>
  );
}

function ShowItem({ show, grid }: { show: TrackedShow; grid: boolean }) {
  return grid ? <ShowPoster show={show} /> : <ShowCard show={show} />;
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
