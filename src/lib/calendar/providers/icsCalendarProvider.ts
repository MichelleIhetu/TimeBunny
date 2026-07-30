import type {
  CalendarDateRange,
  CalendarFetchResult,
  CalendarProvider,
  NormalizedCalendarEvent,
} from "@/types/calendarProvider";

let inMemoryEvents: NormalizedCalendarEvent[] = [];

/** Register ICS-parsed events for the current session (web fallback). */
export function setIcsCalendarEvents(events: NormalizedCalendarEvent[]): void {
  inMemoryEvents = events.map((e) => ({ ...e, source: "ics" as const }));
}

export function getIcsCalendarEvents(): NormalizedCalendarEvent[] {
  return inMemoryEvents;
}

export function clearIcsCalendarEvents(): void {
  inMemoryEvents = [];
}

export const icsCalendarProvider: CalendarProvider = {
  id: "ics",
  displayName: "Imported Calendar File",
  capabilities: {
    canAutoSync: false,
    requiresOAuth: false,
    requiresNativePermission: false,
    supportsChangeNotifications: false,
  },

  isAvailable() {
    return inMemoryEvents.length > 0;
  },

  async fetchEvents(range: CalendarDateRange): Promise<CalendarFetchResult> {
    const min = new Date(range.timeMin).getTime();
    const max = new Date(range.timeMax).getTime();

    const events = inMemoryEvents.filter((e) => {
      const day = new Date(`${e.date}T12:00:00`).getTime();
      return day >= min && day <= max;
    });

    return { events, provider: "ics" };
  },
};
