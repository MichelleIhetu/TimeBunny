/** Pause background calendar sync while a manual import/analysis is in progress. */
let paused = false;

export function setCalendarSyncPaused(value: boolean) {
  paused = value;
}

export function isCalendarSyncPaused(): boolean {
  return paused;
}
