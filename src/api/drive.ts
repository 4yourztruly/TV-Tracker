import { ensureFreshToken } from './auth';
import type { TrackerData } from '../types/show';
import { migrateLegacyTrackerData } from '../utils/migrateLegacyData';

/**
 * Persists TrackerData as a single JSON file in the user's Google Drive
 * "App Data" folder (drive.appdata scope) — hidden from the normal
 * Drive UI, readable/writable only by this app's own token.
 */

const API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FILE_NAME = 'tracker-data.json';
const BOUNDARY = 'tv_tracker_boundary';

function buildMultipartBody(metadata: object, data: unknown): string {
  return (
    `--${BOUNDARY}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${BOUNDARY}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(data)}\r\n` +
    `--${BOUNDARY}--`
  );
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await ensureFreshToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }
  return res;
}

/** Finds the existing tracker file in appData, or creates a fresh empty
 * one if this is the user's first time signing in. Returns the file id. */
export async function findOrCreateFile(): Promise<string> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const searchRes = await authedFetch(
    `${API_BASE}/files?spaces=appDataFolder&fields=files(id,name)&q=${q}`
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length) {
    return searchData.files[0].id;
  }

  const emptyData: TrackerData = { version: 1, shows: [] };
  const createRes = await authedFetch(`${UPLOAD_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
    body: buildMultipartBody(
      { name: FILE_NAME, parents: ['appDataFolder'] },
      emptyData
    ),
  });
  const created = await createRes.json();
  return created.id;
}

export async function readTrackerData(fileId: string): Promise<TrackerData> {
  const res = await authedFetch(`${API_BASE}/files/${fileId}?alt=media`);
  const raw = await res.json();
  // Upgrade data written by the old lastWatchedSeason/lastWatchedEpisode
  // pointer format before it's validated and trusted.
  const data = migrateLegacyTrackerData(raw);
  if (!isValidTrackerData(data)) {
    throw new Error('Tracker data from Drive failed validation.');
  }
  return data;
}

export async function saveTrackerData(fileId: string, data: TrackerData): Promise<void> {
  await authedFetch(`${UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Defense-in-depth shape check. The appdata folder can only be written
 * by this app, but we still validate before trusting it in state — for
 * example an older/newer version of the app may have written a
 * slightly different shape. */
export function isValidTrackerData(x: unknown): x is TrackerData {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Record<string, unknown>;
  if (obj.version !== 1) return false;
  if (!Array.isArray(obj.shows)) return false;
  return obj.shows.every(
    (s) =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as any).id === 'string' &&
      typeof (s as any).title === 'string' &&
      Array.isArray((s as any).watchedEpisodes)
  );
}
