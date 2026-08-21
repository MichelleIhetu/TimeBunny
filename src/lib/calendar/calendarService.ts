import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type {
  CalendarDateRange,
  CalendarProvider,
  CalendarProviderId,
  NormalizedCalendarEvent,
} from "@/types/calendarProvider";
import { googleCalendarProvider, buildGoogleDateRange } from "@/lib/calendar/providers/googleCalendarProvider";
import { eventKitCalendarProvider } from "@/lib/calendar/providers/eventKitProvider";
import { icsCalendarProvider } from "@/lib/calendar/providers/icsCalendarProvider";
import {
  analyzeCalendarEvents,
  calendarEventIds,
  findNewCalendarEvents,
  mergeAnalyzedCalendarTasks,
  type CalendarSyncResult,
} from "@/lib/calendarSync";

const ALL_PROVIDERS: CalendarProvider[] = [
  googleCalendarProvider,
  eventKitCalendarProvider,
  icsCalendarProvider,
];

export function getCalendarProviders(): CalendarProvider[] {
  return ALL_PROVIDERS;
}

export function getCalendarProvider(id: CalendarProviderId): CalendarProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export async function getAvailableCalendarProviders(): Promise<CalendarProvider[]> {
  const checks = await Promise.all(
    ALL_PROVIDERS.map(async (p) => ({ p, ok: await p.isAvailable() })),
  );
  return checks.filter((c) => c.ok).map((c) => c.p);
}

function dedupeEvents(events: NormalizedCalendarEvent[]): NormalizedCalendarEvent[] {
  const byId = new Map<string, NormalizedCalendarEvent>();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });
}

export async function fetchEventsFromProviders(
  range: CalendarDateRange,
  opts?: {
    forceRefresh?: boolean;
    providerIds?: CalendarProviderId[];
  },
): Promise<{
  events: NormalizedCalendarEvent[];
  byProvider: Record<CalendarProviderId, NormalizedCalendarEvent[]>;
  needsAuth: boolean;
  needsEventKitPermission: boolean;
  errors: Partial<Record<CalendarProviderId, string>>;
}> {
  const ids = opts?.providerIds ?? ALL_PROVIDERS.map((p) => p.id);
  const providers = ALL_PROVIDERS.filter((p) => ids.includes(p.id));

  const byProvider = {} as Record<CalendarProviderId, NormalizedCalendarEvent[]>;
  const errors: Partial<Record<CalendarProviderId, string>> = {};
  let needsAuth = false;
  let needsEventKitPermission = false;

  const results = await Promise.all(
    providers.map(async (provider) => {
      const available = await provider.isAvailable();
      if (!available) return { provider, events: [] as NormalizedCalendarEvent[] };

      const result = await provider.fetchEvents(range, { forceRefresh: opts?.forceRefresh });
      if (result.needsAuth) needsAuth = true;
      if (result.needsPermission) needsEventKitPermission = true;
      if (result.error) errors[provider.id] = result.error;
      return { provider, events: result.events };
    }),
  );

  const merged: NormalizedCalendarEvent[] = [];
  for (const { provider, events } of results) {
    byProvider[provider.id] = events;
    merged.push(...events);
  }

  return {
    events: dedupeEvents(merged),
    byProvider,
    needsAuth,
    needsEventKitPermission,
    errors,
  };
}

export async function fetchAllCalendarEvents(opts?: {
  horizonDays?: number;
  forceRefresh?: boolean;
  timeMin?: string;
  timeMax?: string;
}): Promise<ReturnType<typeof fetchEventsFromProviders>> {
  const range = buildGoogleDateRange(opts);
  return fetchEventsFromProviders(range, { forceRefresh: opts?.forceRefresh });
}

export async function syncAllCalendarProviders(opts: {
  existingTasks: AnalyzedTask[];
  horizonDays?: number;
  forceRefresh?: boolean;
}): Promise<CalendarSyncResult & { needsEventKitPermission?: boolean }> {
  const { events, needsAuth, needsEventKitPermission, errors } = await fetchAllCalendarEvents({
    horizonDays: opts.horizonDays,
    forceRefresh: opts.forceRefresh,
  });

  const providerError = Object.values(errors).find(Boolean);
  if (needsAuth && events.length === 0) {
    return {
      tasks: opts.existingTasks,
      newCount: 0,
      removedCount: 0,
      totalEvents: 0,
      needsAuth: true,
      needsEventKitPermission,
      error: providerError,
    };
  }

  if (providerError && events.length === 0) {
    return {
      tasks: opts.existingTasks,
      newCount: 0,
      removedCount: 0,
      totalEvents: 0,
      needsEventKitPermission,
      error: providerError,
    };
  }

  const newEvents = findNewCalendarEvents(opts.existingTasks, events);
  let newlyAnalyzed: AnalyzedTask[] = [];

  if (newEvents.length > 0) {
    try {
      newlyAnalyzed = await analyzeCalendarEvents(newEvents);
    } catch (err) {
      console.warn("[calendar-sync] analyze failed, using raw events", err);
      newlyAnalyzed = newEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date ?? null,
        startTime: e.startTime ?? null,
        endTime: e.endTime ?? null,
        final_category: "event",
        final_importance: "major" as const,
        lead_days: 0,
        recommended_start_date: e.date ?? null,
        prep_milestones: [],
        rationale: "",
        symbolic: { category: "event", matchedKeyword: "" },
      }));
    }
  }

  const { tasks, newCount, removedCount } = mergeAnalyzedCalendarTasks(
    opts.existingTasks,
    events,
    newlyAnalyzed,
  );

  return {
    tasks,
    newCount,
    removedCount,
    totalEvents: events.length,
    needsEventKitPermission,
    newEvents,
  };
}

export function partitionEventsBySource(events: NormalizedCalendarEvent[]) {
  return {
    google: events.filter((e) => e.source === "google"),
    eventKit: events.filter((e) => e.source === "apple_eventkit"),
    ics: events.filter((e) => e.source === "ics"),
  };
}

export function knownEventIds(events: NormalizedCalendarEvent[]): Set<string> {
  return calendarEventIds(events);
}
