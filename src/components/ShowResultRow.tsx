import type { SearchResult } from '../types/show';
import { RatingBadge, type RatingSource } from './RatingBadge';

interface Props {
  result: SearchResult;
  tracked: boolean;
  isAdding: boolean;
  isOpening: boolean;
  hasOpenError: boolean;
  /** A rating already on hand — skips RatingBadge's own OMDb fetch.
   * Leave unset (`undefined`) to have RatingBadge fetch it lazily. */
  knownRating?: string | null;
  /** Which service `knownRating` (or a self-fetch) actually represents
   * — GenreScreen passes the result's own source (TMDB/AniList native
   * rating), SearchResultsScreen passes 'imdb' (or a tracked show's
   * recorded imdbRatingSource). See RatingBadge. */
  ratingSource: RatingSource;
  onOpen: () => void;
  onAdd: () => void;
}

/** A single browse result, styled closer to an IMDb search-result row
 * than the old compact list item — bigger poster, a rating line, and a
 * couple lines of plot summary, so each show carries enough info to
 * judge from the list itself. Shared by GenreScreen and
 * SearchResultsScreen, the two full-screen "browse many results"
 * overlays; the plain SearchScreen tab keeps its own compact
 * live-as-you-type list (still useful as a quick preview while typing,
 * before committing to a full search). */
export function ShowResultRow({
  result,
  tracked,
  isAdding,
  isOpening,
  hasOpenError,
  knownRating,
  ratingSource,
  onOpen,
  onAdd,
}: Props) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer gap-3 rounded-xl border border-ink-800 bg-ink-900 p-3 transition-colors hover:border-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500"
    >
      {result.posterUrl ? (
        <img
          src={result.posterUrl}
          alt=""
          className="h-36 w-24 flex-shrink-0 rounded-lg object-cover bg-ink-800"
        />
      ) : (
        <div className="h-36 w-24 flex-shrink-0 rounded-lg bg-ink-800" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-ink-100">
          {isOpening ? 'Loading…' : result.title}
        </span>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          {result.year && <span>{result.year}</span>}
          <span>{result.source === 'tmdb' ? 'TV' : 'Anime'}</span>
          {!isOpening && (
            <RatingBadge
              title={result.title}
              year={result.year}
              knownRating={knownRating}
              source={ratingSource}
            />
          )}
        </div>
        {hasOpenError ? (
          <p className="text-xs text-red-400">Couldn't load — tap to retry</p>
        ) : (
          result.summary && (
            <p className="line-clamp-3 text-xs leading-relaxed text-ink-400">{result.summary}</p>
          )
        )}
        <div className="mt-auto pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            disabled={tracked || isAdding}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-ink-100 transition-colors hover:border-signal-500 disabled:opacity-40"
          >
            {tracked ? 'Added' : isAdding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
