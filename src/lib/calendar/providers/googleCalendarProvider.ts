import { supabase } from "@/integrations/supabase/client";
import type {
  CalendarDateRange,
  CalendarFetchResult,
  CalendarProvider,
  NormalizedCalendarEvent,
} from "@/types/calendarProvider";

function mapGoogleEvents(raw: Array<Record<string, unknown>>): NormalizedCalendarEvent[] {
  return raw.map((e) => ({
    id: String(e.id ?? ""),
    title: String(e.title ?? "Untitled Event"),
    date: String(e.date ?? ""),
    startTime: e.startTime ? String(e.startTime) : undefined,
    endTime: e.endTime ? String(e.endTime) : undefined,
    description: e.description ? String(e.description) : undefined,
    isAllDay: Boolean(e.isAllDay),
    source: "google" as const,
  }));
}

export const googleCalendarProvider: CalendarProvider = {
  id: "google",
  displayName: "Google Calendar",
  capabilities: {
    canAutoSync: true,
    requiresOAuth: true,
    requiresNativePermission: false,
    supportsChangeNotifications: false,
  },

  isAvailable() {
    return typeof window !== "undefined";
  },

  async fetchEvents(range: CalendarDateRange, opts?: { forceRefresh?: boolean }): Promise<CalendarFetchResult> {
    const timezone = range.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: {
        timezone,
        timeMin: range.timeMin,
        timeMax: range.timeMax,
        forceRefresh: opts?.forceRefresh ?? true,
      },
    });

    if (error) {
      return { events: [], error: error.message || "Failed to fetch Google Calendar", provider: "google" };
    }

    if (data?.needsAuth) {
      return {
        events: mapGoogleEvents(data?.events ?? []),
        needsAuth: true,
        provider: "google",
      };
    }

    if (data?.error) {
      return {
        events: mapGoogleEvents(data?.events ?? []),
        error: String(data.error),
        provider: "google",
      };
    }

    return {
      events: mapGoogleEvents(data?.events ?? []),
      provider: "google",
    };
  },
};

export function buildGoogleDateRange(opts?: {
  horizonDays?: number;
  timeMin?: string;
  timeMax?: string;
}): CalendarDateRange {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  let timeMin = opts?.timeMin ?? "";
  let timeMax = opts?.timeMax ?? "";

  if (!timeMin || !timeMax) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + (opts?.horizonDays ?? 31));
    timeMin = start.toISOString();
    timeMax = end.toISOString();
  }

  return { timeMin, timeMax, timezone };
}

export async function fetchGoogleCalendarEvents(opts?: {
  horizonDays?: number;
  forceRefresh?: boolean;
  timeMin?: string;
  timeMax?: string;
}): Promise<Pick<CalendarFetchResult, "events" | "needsAuth" | "error">> {
  const range = buildGoogleDateRange(opts);
  const result = await googleCalendarProvider.fetchEvents(range, {
    forceRefresh: opts?.forceRefresh,
  });
  return { events: result.events, needsAuth: result.needsAuth, error: result.error };
}
