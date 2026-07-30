import { supabase } from "@/integrations/supabase/client";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { NormalizedCalendarEvent } from "@/types/calendarProvider";
import { localDateString } from "@/lib/localTime";

export const CALENDAR_SYNCED_EVENT = "timebunny:calendar-synced";

/** @deprecated Prefer NormalizedCalendarEvent from @/types/calendarProvider */
export type CalendarEvent = NormalizedCalendarEvent;

export type CalendarSyncResult = {
  tasks: AnalyzedTask[];
  newCount: number;
  removedCount: number;
  totalEvents: number;
  needsAuth?: boolean;
  error?: string;
};


/** Merged sync across Google + EventKit (+ ICS when imported). */
export { syncAllCalendarProviders, syncAllCalendarProviders as syncAllCalendars } from "@/lib/calendar/calendarService";

export function calendarEventIds(events: Array<{ id: string }>): Set<string> {
  return new Set(events.map((e) => e.id));
}

export function findNewCalendarEvents(
  existing: AnalyzedTask[],
  fetched: CalendarEvent[],
): CalendarEvent[] {
  const known = calendarEventIds(existing);
  return fetched.filter((e) => !known.has(e.id));
}

export async function fetchLiveCalendarEvents(opts?: {
  horizonDays?: number;
  forceRefresh?: boolean;
  timeMin?: string;
  timeMax?: string;
}): Promise<{ events: CalendarEvent[]; needsAuth?: boolean; error?: string }> {
  return fetchGoogleCalendarEvents(opts);
}

export async function analyzeCalendarEvents(
  events: CalendarEvent[],
  today = localDateString(),
): Promise<AnalyzedTask[]> {
  if (events.length === 0) return [];

  const { data, error } = await supabase.functions.invoke("analyze-calendar-tasks", {
    body: { events, today },
  });

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Calendar analysis failed");
  }

  return (data?.analyzed ?? []) as AnalyzedTask[];
}

export function mergeAnalyzedCalendarTasks(
  existing: AnalyzedTask[],
  fetchedEvents: CalendarEvent[],
  newlyAnalyzed: AnalyzedTask[],
): { tasks: AnalyzedTask[]; newCount: number; removedCount: number } {
  const fetchedIds = calendarEventIds(fetchedEvents);
  const kept = existing.filter((t) => fetchedIds.has(t.id));
  const keptIds = calendarEventIds(kept);
  const additions = newlyAnalyzed.filter((t) => !keptIds.has(t.id));

  const merged = [...kept, ...additions].sort((a, b) => {
    const dateCmp = (a.date || "").localeCompare(b.date || "");
    if (dateCmp !== 0) return dateCmp;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  return {
    tasks: merged,
    newCount: additions.length,
    removedCount: existing.length - kept.length,
  };
}

export async function syncCalendarWithGoogle(opts: {
  existingTasks: AnalyzedTask[];
  horizonDays?: number;
  forceRefresh?: boolean;
}): Promise<CalendarSyncResult> {
  const { events, needsAuth, error } = await fetchLiveCalendarEvents({
    horizonDays: opts.horizonDays,
    forceRefresh: opts.forceRefresh,
  });

  if (needsAuth) {
    return {
      tasks: opts.existingTasks,
      newCount: 0,
      removedCount: 0,
      totalEvents: events.length,
      needsAuth: true,
    };
  }

  if (error) {
    return {
      tasks: opts.existingTasks,
      newCount: 0,
      removedCount: 0,
      totalEvents: events.length,
      error,
    };
  }

  const newEvents = findNewCalendarEvents(opts.existingTasks, events);
  let newlyAnalyzed: AnalyzedTask[] = [];

  if (newEvents.length > 0) {
    newlyAnalyzed = await analyzeCalendarEvents(newEvents);
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
  };
}

export function dispatchCalendarSynced(tasks: AnalyzedTask[], newCount: number) {
  window.dispatchEvent(
    new CustomEvent(CALENDAR_SYNCED_EVENT, { detail: { tasks, newCount } }),
  );
}
