/** User-local date/time helpers — always use instead of UTC toISOString().slice(0,10). */

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getUtcOffsetMinutes(date: Date = new Date()): number {
  return -date.getTimezoneOffset();
}

/** YYYY-MM-DD in the user's local timezone. */
export function localDateString(date: Date = new Date(), timezone?: string): string {
  const tz = timezone ?? getUserTimezone();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** YYYY-MM in local timezone. */
export function localMonthString(date: Date = new Date(), timezone?: string): string {
  return localDateString(date, timezone).slice(0, 7);
}

/** HH:mm (24h) in local timezone. */
export function localTimeString(date: Date = new Date(), timezone?: string): string {
  const tz = timezone ?? getUserTimezone();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Seconds since local midnight, including the current second. */
export function localNowSeconds(date: Date = new Date(), timezone?: string): number {
  const hhmm = localTimeString(date, timezone);
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + date.getSeconds();
}

/** Parse YYYY-MM-DD as local midnight. */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Add days to a local date string, return YYYY-MM-DD. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

/** Last day of current month as YYYY-MM-DD (local). */
export function endOfMonthDateString(date: Date = new Date()): string {
  return localDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** Extract local calendar date from an event date/time string. */
export function eventLocalDateString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const dateOnly = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && raw.length === 10) return dateOnly;
  try {
    return localDateString(new Date(raw));
  } catch {
    return null;
  }
}

export type LocalTimeSnapshot = {
  now: Date;
  timezone: string;
  localDate: string;
  localMonth: string;
  localTime: string;
  utcOffsetMinutes: number;
  iso: string;
};

export function getLocalTimeSnapshot(date: Date = new Date()): LocalTimeSnapshot {
  return {
    now: date,
    timezone: getUserTimezone(),
    localDate: localDateString(date),
    localMonth: localMonthString(date),
    localTime: localTimeString(date),
    utcOffsetMinutes: getUtcOffsetMinutes(date),
    iso: date.toISOString(),
  };
}

/** Milliseconds until next local midnight. */
export function msUntilLocalMidnight(date: Date = new Date()): number {
  const tomorrow = new Date(date);
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(1000, tomorrow.getTime() - date.getTime());
}

export const LOCAL_MIDNIGHT_EVENT = "timebunny:local-midnight";

/** Notify listeners when the local calendar day rolls over (midnight) or tab refocuses. */
export function startLocalTimeSync(onTick: () => void): () => void {
  const tick = () => onTick();

  const interval = window.setInterval(tick, 60_000);
  let midnightTimer = window.setTimeout(function scheduleMidnight() {
    tick();
    midnightTimer = window.setTimeout(scheduleMidnight, msUntilLocalMidnight());
  }, msUntilLocalMidnight());

  const onVisible = () => {
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.clearInterval(interval);
    window.clearTimeout(midnightTimer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
