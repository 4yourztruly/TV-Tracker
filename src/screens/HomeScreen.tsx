import { useAppStore } from '../store/store';
import { ShowCard } from '../components/ShowCard';
import { isShowUpToDate } from '../utils/progress';

export function HomeScreen() {
  const shows = useAppStore((s) => s.shows);

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

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {watching.length > 0 && (
        <Section title="Watching">
          {watching.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </Section>
      )}

      {unwatched.length > 0 && (
        <Section title="Watchlist">
          {unwatched.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </Section>
      )}

      {upToDate.length > 0 && (
        <Section title="Up to date">
          {upToDate.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="Completed">
          {completed.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
