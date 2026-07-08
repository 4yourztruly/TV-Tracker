import type { SeriesStatus } from '../types/show';

/** Formats a show's run as a compact year string:
 *  - ended, different start/end years → "2008-2013"
 *  - ended, same start/end year → "2008"
 *  - ongoing/unknown, or ended without a known end year → "2016-"
 *  - no known start year → null (nothing to show)
 */
export function formatYearRange(
  startYear: string | null | undefined,
  endYear: string | null | undefined,
  seriesStatus: SeriesStatus | undefined
): string | null {
  if (!startYear) return null;
  if (seriesStatus === 'ended') {
    if (!endYear || endYear === startYear) return startYear;
    return `${startYear}-${endYear}`;
  }
  return `${startYear}-`;
}
