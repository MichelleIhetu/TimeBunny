/** How far ahead we watch for urgent calendar changes (post-it trigger). */
export const URGENT_LOOKAHEAD_HOURS = 24;

/** Poll Google/EventKit while the app is open — no manual re-sync needed. */
export const BACKGROUND_SYNC_INTERVAL_MS = 60 * 1000;

/** Minimum gap between consecutive background pulls. */
export const BACKGROUND_SYNC_MIN_GAP_MS = 30 * 1000;

/** Delay before the first pull after sign-in / app load. */
export const BACKGROUND_SYNC_INITIAL_DELAY_MS = 800;

export const CALENDAR_BACKGROUND_SYNC_STATUS_EVENT = "timebunny:calendar-background-sync-status";

export type CalendarBackgroundSyncStatus = {
  lastSyncAt: number | null;
  lastNewCount: number;
  running: boolean;
};

let lastStatus: CalendarBackgroundSyncStatus = {
  lastSyncAt: null,
  lastNewCount: 0,
  running: false,
};

export function dispatchCalendarBackgroundSyncStatus(partial: Partial<CalendarBackgroundSyncStatus>) {
  lastStatus = { ...lastStatus, ...partial };
  window.dispatchEvent(
    new CustomEvent(CALENDAR_BACKGROUND_SYNC_STATUS_EVENT, { detail: lastStatus }),
  );
}

export function getCalendarBackgroundSyncStatus(): CalendarBackgroundSyncStatus {
  return lastStatus;
}
