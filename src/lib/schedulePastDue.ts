import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import { journalContentToPlainText } from "@/lib/journalReferences";
import { localDateString } from "@/lib/localTime";
import type { GoalForSchedule } from "@/lib/goalsSchedule";
import type { ScheduleItem } from "@/types/schedule";

const STOP_WORDS = new Set([
  "about",
  "after",
  "application",
  "calendar",
  "class",
  "event",
  "from",
  "google",
  "lecture",
  "meeting",
  "prep",
  "review",
  "session",
  "task",
  "the",
  "this",
  "today",
  "untitled",
  "weekly",
  "with",
  "work",
  "zoom",
]);

const parseHHMM = (time: string | undefined | null): number | null => {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function significantTitleTokens(title: string): string[] {
  return normalize(title)
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

/** True when the journal (or a journal @-reference) actually names this item. */
export function journalMentionsTitle(journalText: string | undefined, title: string): boolean {
  const hay = normalize(journalContentToPlainText(journalText ?? ""));
  if (!hay) return false;

  const compact = normalize(title);
  if (compact.length >= 4 && hay.includes(compact)) return true;

  const tokens = significantTitleTokens(title);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((token) => hay.includes(token));
  if (tokens.length === 1) return hits.length === 1;
  return hits.length >= Math.min(2, tokens.length);
}

export function isPastDueDate(dateStr: string | null | undefined, today = localDateString()): boolean {
  const date = dateStr?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date < today;
}

/** Event date is before today, or today's timed event already ended. */
export function calendarEventIsPast(
  task: Pick<AnalyzedTask, "date" | "endTime">,
  today = localDateString(),
  nowHHMM?: string,
): boolean {
  if (!task.date) return false;
  if (task.date < today) return true;
  if (task.date > today) return false;
  const now = parseHHMM(nowHHMM);
  const end = parseHHMM(task.endTime);
  if (now !== null && end !== null) return now >= end;
  return false;
}

export function filterCalendarAnalysisForSchedule(
  tasks: AnalyzedTask[] | undefined,
  opts?: { journalText?: string; today?: string; nowHHMM?: string },
): AnalyzedTask[] {
  if (!tasks?.length) return [];
  const today = opts?.today ?? localDateString();
  const journalText = opts?.journalText ?? "";

  return tasks.filter((task) => {
    if (!calendarEventIsPast(task, today, opts?.nowHHMM)) return true;
    return journalMentionsTitle(journalText, task.title);
  });
}

export function filterGoalsForSchedule<T extends { title: string; end_date?: string | null }>(
  goals: T[] | undefined,
  opts?: { journalText?: string; today?: string },
): T[] {
  if (!goals?.length) return [];
  const today = opts?.today ?? localDateString();
  const journalText = opts?.journalText ?? "";

  return goals.filter((goal) => {
    if (!isPastDueDate(goal.end_date, today)) return true;
    return journalMentionsTitle(journalText, goal.title);
  });
}

const itemRefersToTitle = (item: ScheduleItem, sourceTitle: string): boolean => {
  const hay = normalize(`${item.title} ${item.description ?? ""}`);
  const compact = normalize(sourceTitle);
  if (compact.length >= 4 && hay.includes(compact)) return true;
  const tokens = significantTitleTokens(sourceTitle);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((token) => hay.includes(token));
  return hits.length >= Math.min(2, Math.max(1, tokens.length));
};

/**
 * Drop generated prep / goal blocks for past-due calendar items and overdue goals
 * unless the journal asked to keep working on them.
 */
export function dropUnrequestedPastDueItems(
  schedule: ScheduleItem[],
  opts: {
    calendarAnalysis?: AnalyzedTask[];
    goals?: GoalForSchedule[];
    journalText?: string;
    today?: string;
    nowHHMM?: string;
  },
): ScheduleItem[] {
  const today = opts.today ?? localDateString();
  const journalText = opts.journalText ?? "";
  const pastEvents = (opts.calendarAnalysis ?? []).filter((task) =>
    calendarEventIsPast(task, today, opts.nowHHMM),
  );
  const overdueGoals = (opts.goals ?? []).filter((goal) => isPastDueDate(goal.end_date, today));

  if (pastEvents.length === 0 && overdueGoals.length === 0) return schedule;

  return schedule.filter((item) => {
    const pastEvent = pastEvents.find((task) => itemRefersToTitle(item, task.title));
    if (pastEvent && !journalMentionsTitle(journalText, pastEvent.title)) return false;

    const overdueGoal = overdueGoals.find((goal) => itemRefersToTitle(item, goal.title));
    if (overdueGoal && !journalMentionsTitle(journalText, overdueGoal.title)) return false;

    return true;
  });
}

export const PAST_DUE_SCHEDULE_RULES = `
PAST-DUE / PAST EVENTS (NON-NEGOTIABLE):
- Do NOT schedule prep, catch-up, or leftover work for calendar events whose date is already past.
- Do NOT put overdue goals on today's schedule just because their finish-by date elapsed.
- The ONLY exception is when the user's journal explicitly names that past-due task as still needing work.
- If a future event's prep start date is already past, you MAY still schedule prep for that upcoming event.`;
