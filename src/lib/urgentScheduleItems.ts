import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { NormalizedCalendarEvent } from "@/types/calendarProvider";
import { getUserTimezone, localDateString, parseLocalDate } from "@/lib/localTime";
import { dispatchScheduleUpdateNeeded } from "@/lib/scheduleUpdateNotice";

const HOUR_MS = 60 * 60 * 1000;

type DueTimeOptions = {
  /** All-day calendar events use a morning deadline on future days. */
  isAllDay?: boolean;
};

function parseTaskDateTime(
  date: string,
  time?: string | null,
  now: Date = new Date(),
  opts?: DueTimeOptions,
): Date | null {
  if (!date) return null;
  const base = parseLocalDate(date);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      base.setHours(h, m, 0, 0);
      return base;
    }
  }

  const today = localDateString(now);
  if (date === today) {
    base.setHours(23, 59, 59, 999);
    return base;
  }

  // Future date-only / all-day items (e.g. "tomorrow" homework) → assume morning.
  if (opts?.isAllDay || !time) {
    base.setHours(9, 0, 0, 0);
    return base;
  }

  base.setHours(23, 59, 59, 999);
  return base;
}

/** True when the item starts (or is due) within the next 24 hours. */
export function isDueWithin24Hours(
  date: string | null | undefined,
  startTime?: string | null,
  now: Date = new Date(),
  opts?: DueTimeOptions,
): boolean {
  if (!date) return false;
  const due = parseTaskDateTime(date, startTime, now, opts);
  if (!due) return false;
  const delta = due.getTime() - now.getTime();
  return delta >= -HOUR_MS && delta <= 24 * HOUR_MS;
}

export function isAnalyzedTaskDueWithin24Hours(task: AnalyzedTask, now = new Date()): boolean {
  return isDueWithin24Hours(task.date, task.startTime, now, {
    isAllDay: !task.startTime,
  });
}

export function isCalendarEventDueWithin24Hours(
  event: Pick<NormalizedCalendarEvent, "date" | "startTime" | "isAllDay">,
  now = new Date(),
): boolean {
  return isDueWithin24Hours(event.date, event.startTime, now, {
    isAllDay: event.isAllDay ?? !event.startTime,
  });
}

export function filterUrgentAnalyzedTasks(tasks: AnalyzedTask[], now = new Date()): AnalyzedTask[] {
  return tasks.filter((t) => isAnalyzedTaskDueWithin24Hours(t, now));
}

/** Human-readable due label for the post-it. */
export function formatUrgentDueLabel(task: AnalyzedTask): string {
  const now = new Date();
  const today = localDateString(now, getUserTimezone());
  if (task.date === today && task.startTime) return `Today ${task.startTime}`;
  if (task.date === today) return "Today";
  if (task.date) return task.startTime ? `${task.date} ${task.startTime}` : task.date;
  return "Soon";
}

export function toScheduleNoticeTask(input: {
  id: string;
  title: string;
  date: string | null;
  startTime?: string | null;
}): AnalyzedTask {
  return {
    id: input.id,
    title: input.title,
    date: input.date,
    startTime: input.startTime ?? null,
    endTime: null,
    final_category: "manual",
    final_importance: "major",
    lead_days: 0,
    recommended_start_date: input.date,
    prep_milestones: [],
    rationale: "",
    symbolic: { category: "manual", matchedKeyword: "" },
  };
}

/** Show the post-it when newly synced/added items are due within 24 hours. */
export function notifyUrgentNewTasks(
  beforeTasks: AnalyzedTask[],
  afterTasks: AnalyzedTask[],
  source: "calendar" | "manual" = "calendar",
  newRawEvents: Array<Pick<NormalizedCalendarEvent, "id" | "title" | "date" | "startTime" | "isAllDay">> = [],
) {
  const beforeIds = new Set(beforeTasks.map((t) => t.id));
  const newlyAdded = afterTasks.filter((t) => !beforeIds.has(t.id));
  const urgentFromAnalyzed = filterUrgentAnalyzedTasks(newlyAdded);

  const urgentFromRaw = newRawEvents
    .filter((e) => e.id && !beforeIds.has(e.id))
    .filter((e) => isCalendarEventDueWithin24Hours(e))
    .map((e) =>
      toScheduleNoticeTask({
        id: e.id,
        title: e.title,
        date: e.date,
        startTime: e.startTime ?? null,
      }),
    );

  const byId = new Map<string, AnalyzedTask>();
  for (const task of [...urgentFromAnalyzed, ...urgentFromRaw]) {
    byId.set(task.id, task);
  }
  const urgentNew = Array.from(byId.values());

  if (urgentNew.length > 0) {
    dispatchScheduleUpdateNeeded({ tasks: urgentNew, source });
  }
  return urgentNew;
}

export function notifyUrgentTasksIfDue(
  tasks: Array<{ id: string; title: string; date: string | null; startTime?: string | null }>,
  source: "calendar" | "manual" = "manual",
) {
  const urgent = tasks
    .filter((t) => isDueWithin24Hours(t.date, t.startTime))
    .map((t) => toScheduleNoticeTask(t));
  if (urgent.length > 0) {
    dispatchScheduleUpdateNeeded({ tasks: urgent, source });
  }
}
