import type { SearchResult } from '../types/show';
import { Spinner } from './Spinner';

interface Props {
  shows: SearchResult[];
  /** Key (`${source}-${sourceId}`) of the tile currently being opened,
   * so only that one shows a loading spinner instead of the whole row. */
  openingKey: string | null;
  onSelect: (result: SearchResult) => void;
}

/** "You might also like" strip at the bottom of the show detail
 * screen. Tapping a tile opens it the same way tapping a search
 * result does — as a preview if not yet tracked, or the real tracked
 * show if it already is (see ShowDetailScreen.handleOpenRelatedShow). */
export function RelatedShows({ shows, openingKey, onSelect }: Props) {
  if (shows.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        Related Shows
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {shows.map((result) => {
          const key = `${result.source}-${result.sourceId}`;
          const isOpening = openingKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(result)}
              disabled={isOpening}
              className="flex w-24 flex-shrink-0 flex-col gap-1.5 text-left disabled:opacity-60"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink-800 ring-1 ring-inset ring-ink-800">
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-ink-500">
                    {result.title}
                  </div>
                )}
                {isOpening && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60">
                    <Spinner size={20} />
                  </div>
                )}
              </div>
              <p className="truncate text-xs font-medium text-ink-200">{result.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
