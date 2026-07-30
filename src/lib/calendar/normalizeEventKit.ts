import type { NativeEventKitEventPayload, NormalizedCalendarEvent } from "@/types/calendarProvider";

const EVENTKIT_ID_PREFIX = "eventkit:";

export function eventKitEventId(identifier: string): string {
  return `${EVENTKIT_ID_PREFIX}${identifier}`;
}

export function isEventKitEventId(id: string): boolean {
  return id.startsWith(EVENTKIT_ID_PREFIX);
}

function toLocalDateParts(iso: string, timezone: string): { date: string; time: string } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(d);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    time: `${pick("hour")}:${pick("minute")}`,
  };
}

export function normalizeEventKitEvent(
  payload: NativeEventKitEventPayload,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
): NormalizedCalendarEvent {
  const start = toLocalDateParts(payload.startDateIso, timezone);
  const end = toLocalDateParts(payload.endDateIso, timezone);

  return {
    id: eventKitEventId(payload.eventIdentifier),
    title: payload.title || "Untitled Event",
    date: start.date,
    startTime: payload.isAllDay ? undefined : start.time,
    endTime: payload.isAllDay ? undefined : end.time,
    description: payload.notes,
    isAllDay: payload.isAllDay,
    source: "apple_eventkit",
    sourceCalendarId: payload.calendarIdentifier,
    sourceCalendarTitle: payload.calendarTitle,
    externalUrl: payload.url,
    lastModified: payload.lastModifiedDateIso,
  };
}

export function normalizeEventKitEvents(
  payloads: NativeEventKitEventPayload[],
  timezone?: string,
): NormalizedCalendarEvent[] {
  return payloads.map((p) => normalizeEventKitEvent(p, timezone));
}
