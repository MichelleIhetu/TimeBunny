import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";

import type { CalendarProviderId } from "@/types/calendarProvider";

import type { ScheduleItem } from "@/types/schedule";

import { isEventKitEventId } from "@/lib/calendar/normalizeEventKit";

import { addDaysToDateString, localDateString } from "@/lib/localTime";



export interface ResolvedScheduleCalendarEvent {

  source: CalendarProviderId;

  /** App-level id (may be composite for Google). */

  eventId: string;

  /** Raw provider id when different (EventKit identifier). */

  rawEventId?: string;

  calendarId?: string;

  title: string;

}



function normalizeTitle(value: string): string {

  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

}



function titlesMatch(a: string, b: string): boolean {

  const na = normalizeTitle(a);

  const nb = normalizeTitle(b);

  if (!na || !nb) return false;

  return na === nb || na.includes(nb) || nb.includes(na);

}



function normalizeTime(time: string): string | null {

  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);

  if (!match) return null;

  const h = Number(match[1]);

  const m = Number(match[2]);

  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

}



function inferSourceFromAnalyzedId(id: string): CalendarProviderId {

  if (isEventKitEventId(id)) return "apple_eventkit";

  return "google";

}



function fromAnalyzedTask(task: AnalyzedTask): ResolvedScheduleCalendarEvent {

  const source = inferSourceFromAnalyzedId(task.id);

  return {

    source,

    eventId: task.id,

    rawEventId: source === "apple_eventkit" ? task.id.replace(/^eventkit:/, "") : undefined,

    title: task.title,

  };

}



function fromScheduleItemId(item: ScheduleItem): ResolvedScheduleCalendarEvent | null {

  if (isEventKitEventId(item.id)) {

    return {

      source: "apple_eventkit",

      eventId: item.id,

      rawEventId: item.id.replace(/^eventkit:/, ""),

      title: item.title,

    };

  }

  if (parseGoogleCompositeEventId(item.id)) {

    return {

      source: "google",

      eventId: item.id,

      title: item.title,

    };

  }

  return null;

}



/** Link a schedule block to its source calendar event (Google / Apple). */

export function resolveCalendarEventForScheduleItem(

  item: ScheduleItem,

  calendarAnalysis: AnalyzedTask[],

): ResolvedScheduleCalendarEvent | null {

  if (item.goalId) return null;

  if (/\bbreak\b/i.test(item.title)) return null;



  const byDirectId = calendarAnalysis.find((t) => t.id === item.id);

  if (byDirectId) return fromAnalyzedTask(byDirectId);



  const fromItemId = fromScheduleItemId(item);

  if (fromItemId) return fromItemId;



  const today = localDateString();

  const tomorrow = addDaysToDateString(today, 1);

  const candidates = calendarAnalysis.filter(

    (t) => t.date === today || t.date === tomorrow,

  );



  const itemTime = normalizeTime(item.time);

  if (itemTime) {

    const byTimeAndTitle = candidates.find((t) => {

      const taskTime = t.startTime ? normalizeTime(t.startTime) : null;

      return taskTime === itemTime && titlesMatch(t.title, item.title);

    });

    if (byTimeAndTitle) return fromAnalyzedTask(byTimeAndTitle);

  }



  const strippedTitle = item.title.replace(/^(\[FIXED\]|🎯)\s*/i, "").trim();

  const byTitle = candidates.find(

    (t) => titlesMatch(t.title, item.title) || titlesMatch(t.title, strippedTitle),

  );

  if (byTitle) return fromAnalyzedTask(byTitle);



  return null;

}



/** Parse Google composite ids like `{googleEventId}-{user@gmail.com}`. */

export function parseGoogleCompositeEventId(

  compositeId: string,

): { googleEventId: string; calendarHint: string } | null {

  const at = compositeId.indexOf("@");

  if (at === -1) {

    return { googleEventId: compositeId, calendarHint: "primary" };

  }

  const dash = compositeId.lastIndexOf("-", at);

  if (dash === -1) return null;

  return {

    googleEventId: compositeId.slice(0, dash),

    calendarHint: compositeId.slice(dash + 1),

  };

}



export function googleCalendarEventDeepLink(googleEventId: string, calendarId: string): string {

  const raw = `${googleEventId} ${calendarId}`;

  const eid = btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eid)}`;

}


