import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { getImdbRating } from '../api/omdb';

interface Props {
  title: string;
  year?: string;
  className?: string;
  /** A rating already on hand (e.g. from a tracked show's cached
   * `imdbRating`) — skips the OMDb lookup entirely when provided.
   * `null` means "already checked, no rating"; leave unset to have
   * this component fetch it itself. */
  knownRating?: string | null;
  /** Called once the rating settles (found, not found, or supplied via
   * `knownRating`), so a parent can hold a loading spinner over a
   * whole list of these until every rating is in, instead of ratings
   * popping in one at a time. */
  onReady?: () => void;
}

/** A small "★ 8.4" IMDb rating badge. Renders nothing while loading or
 * if OMDb doesn't have a rating for this title (no key configured, no
 * match, thin anime coverage, etc.) — this is supplementary info, so
 * it fails silently rather than showing a loading flicker or an empty
 * state that competes with the show's own data. */
export function ImdbRating({ title, year, className = '', knownRating, onReady }: Props) {
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
      className={`inline-flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold text-signal-500 ${className}`}
    >
      <Star className="h-3 w-3 fill-current" />
      {rating}
    </span>
  );
}
