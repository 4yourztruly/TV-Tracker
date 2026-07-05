import type { TrackerData } from '../types/show';
import { isValidTrackerData } from '../api/drive';
import { migrateLegacyTrackerData } from './migrateLegacyData';

/** Triggers a browser download of the current tracker data as JSON.
 * Since the Drive appData storage is hidden from the user by design,
 * this is the manual way for someone to back up, inspect, or migrate
 * their data. */
export function exportTrackerData(data: TrackerData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tv-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Reads a user-selected JSON file and validates its shape before
 * returning it. Throws if the file isn't a valid tracker export —
 * imported data is untrusted input just like anything else from outside
 * the app. */
export function importTrackerData(file: File): Promise<TrackerData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        // Older exports (pointer-only or plain watched-array shape) need
        // to be normalized to the current watch-count map shape before
        // validation, same as the Drive-load and persisted-store paths.
        const migrated = migrateLegacyTrackerData(parsed as { shows?: unknown });
        if (!isValidTrackerData(migrated)) {
          reject(new Error('This file is not a valid TV Tracker export.'));
          return;
        }
        resolve(migrated);
      } catch (err) {
        reject(new Error('Could not parse file as JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}
