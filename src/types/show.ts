export type WatchStatus = 'unwatched' | 'watching' | 'completed';

export type ShowSource = 'tmdb' | 'jikan';

export type SeriesStatus = 'ended' | 'ongoing' | 'unknown';

export interface EpisodeInfo {
  season: number;
  episode: number;
  title?: string;
  airdate?: string;
  /** Episode still/thumbnail image, when the source provides one.
   * TMDB does (per-episode "still"); Jikan/MAL's episode list doesn't,
   * so anime episodes won't have one. */
  imageUrl?: string;
}

export interface SeasonSummary {
  season: number;
  episodeCount: number;
  episodes?: EpisodeInfo[]; // populated lazily when the season is expanded
}

export interface TrackedShow {
  id: string; // internal uuid
  source: ShowSource;
  sourceId: number;
  title: string;
  summary?: string;
  posterUrl?: string;
  status: WatchStatus;

  /** Watch count per episode, keyed as "season-episode" (e.g. "2-14").
   * A count rather than a plain watched/unwatched flag, so rewatching
   * an episode can be tracked (2x, 3x, ...) instead of collapsing back
   * to "watched". A key's absence (or a count of 0) means unwatched;
   * any count >= 1 means watched, with the count feeding total watch
   * time in Settings > Stats. Stored as a plain object for simple JSON
   * serialization to Drive. */
  watchedEpisodes: Record<string, number>;

  /** Total known episode count. May be null for ongoing anime with an
   * unknown final count (Jikan can return null). */
  totalEpisodes: number | null;

  /** Whether the real-world series is finished or still expected to
   * continue. Used to distinguish "Completed" from "Up to date" when
   * all currently-known episodes are watched. */
  seriesStatus?: SeriesStatus;
  seriesStatusUpdatedAt?: number;
  seriesStatusVersion?: number;

  /** Average episode runtime in minutes, when the source API reports
   * one. Used to estimate total watch time in Settings > Stats. */
  episodeRuntimeMinutes?: number;

  seasons: SeasonSummary[];

  notes?: string;
  addedAt: number;
  updatedAt: number;
}

/** Lightweight shape returned by search, before a show is added to the list. */
export interface SearchResult {
  source: ShowSource;
  sourceId: number;
  title: string;
  posterUrl?: string;
  summary?: string;
  year?: string;
}

/** Shape of the JSON blob synced to the Google Drive appData folder. */
export interface TrackerData {
  version: 1;
  shows: TrackedShow[];
}
