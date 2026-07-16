import { useEffect, useState } from 'react';
import { getImdbRating } from '../api/omdb';
import { ratingTextColorClass, type RatingSource } from '../utils/ratingSource';

export type { RatingSource };

/** Each service gets its own recognizable mark instead of one generic
 * star for every rating — an IMDb rating shows IMDb's yellow star, a
 * TMDB-native rating (see GenreScreen) shows TMDB's green circle, an
 * AniList-native one shows AniList's blue smiley. These are simplified
 * stand-ins evoking each brand's color/shape, not traced reproductions
 * of the real logos. */
export function RatingSourceIcon({ source, className }: { source: RatingSource; className: string }) {
  switch (source) {
    case 'imdb':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            fill="#F5C518"
            stroke="#F5C518"
            strokeWidth="1"
            strokeLinejoin="round"
            d="M12 2.5l2.94 6.36 6.86.66-5.2 4.7 1.57 6.78L12 17.27l-6.17 3.73 1.57-6.78-5.2-4.7 6.86-.66z"
          />
        </svg>
      );
    case 'anilist':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#02A9FF" />
          <circle cx="8.5" cy="10.25" r="1.35" fill="white" />
          <circle cx="15.5" cy="10.25" r="1.35" fill="white" />
          <path
            d="M7.75 14.25c0.9 1.6 2.7 2.6 4.25 2.6s3.35-1 4.25-2.6"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case 'tmdb':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#01D277" />
          <circle cx="12" cy="12" r="4.5" fill="#0d253f" />
        </svg>
      );
  }
}

interface Props {
  title: string;
  year?: string;
  className?: string;
  /** A rating already on hand (e.g. from a tracked show's cached
   * `imdbRating`, or a search result's own `rating`) — skips the OMDb
   * lookup entirely when provided. `null` means "already checked, no
   * rating"; leave unset to have this component fetch it itself (OMDb
   * only — see `source`). */
  knownRating?: string | null;
  /** Called once the rating settles (found, not found, or supplied via
   * `knownRating`), so a parent can hold a loading spinner over a
   * whole list of these until every rating is in, instead of ratings
   * popping in one at a time. */
  onReady?: () => void;
  /** Which service this rating actually came from, driving which icon
   * renders (see SourceIcon). This component's own self-fetch (when
   * `knownRating` is left unset) always hits OMDb, so that path is
   * always effectively 'imdb' — callers displaying a TMDB/AniList-
   * native rating (e.g. GenreScreen) always pass `knownRating` too, so
   * self-fetch never fires for those in practice. */
  source: RatingSource;
}

/** A small "[icon] 8.4" rating badge. Renders nothing while loading or
 * if there's no rating to show (no key configured, no match, thin
 * anime coverage, etc.) — this is supplementary info, so it fails
 * silently rather than showing a loading flicker or an empty state
 * that competes with the show's own data. */
export function RatingBadge({ title, year, className = '', knownRating, onReady, source }: Props) {
  const [rating, setRating] = useState<string | null>(knownRating ?? null);
  const hasKnownRating = knownRating !== undefined;

  useEffect(() => {
    if (hasKnownRating) {
      setRating(knownRating);
      onReady?.();
      return;
    }

    let cancelled = false;
    setRating(null);
    getImdbRating(title, year).then((r) => {
      if (cancelled) return;
      setRating(r ?? null); // undefined (transient failure) just means no badge here
      onReady?.();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, year, hasKnownRating, knownRating]);

  if (!rating) return null;

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold ${ratingTextColorClass(source)} ${className}`}
    >
      <RatingSourceIcon source={source} className="h-3.5 w-3.5" />
      {rating}
    </span>
  );
}
