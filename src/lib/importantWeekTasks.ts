import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { GoalWithProgress } from "@/hooks/useGoals";
import { isGoalComplete } from "@/lib/goalCarrots";
import { daysUntilDeadline, normalizeGoalUrgency } from "@/lib/goalUrgency";
import { addDaysToDateString, localDateString, parseLocalDate } from "@/lib/localTime";

export type WeekPriorityKind = "event" | "prep" | "goal";

export type WeekPriorityItem = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  endTime?: string | null;
  importance: "critical" | "major";
  kind: WeekPriorityKind;
  happeningNow?: boolean;
  remainingMinutes?: number;
};

export type WeekPriorityGroup = {
  date: string;
  label: string;
  items: WeekPriorityItem[];
};

const IMPORTANCE_RANK: Record<WeekPriorityItem["importance"], number> = {
  critical: 0,
  major: 1,
};

const parseHHMMMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const eventHasEnded = (task: AnalyzedTask, today: string, nowMinutes: number | null) => {
  if (task.date !== today || nowMinutes === null) return false;
  const end = parseHHMMMinutes(task.endTime);
  if (end !== null) return nowMinutes >= end;
  return false;
};

const eventIsHappening = (task: AnalyzedTask, today: string, nowMinutes: number | null) => {
  if (task.date !== today || nowMinutes === null) return false;
  const start = parseHHMMMinutes(task.startTime);
  const end = parseHHMMMinutes(task.endTime);
  if (start === null) return false;
  if (end !== null) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start && nowMinutes < start + 60;
};

export function remainingMinutesUntil(endTime: string | null | undefined, nowMinutes: number): number | null {
  const end = parseHHMMMinutes(endTime);
  if (end === null) return null;
  return Math.max(0, end - nowMinutes);
}

const isImportantCalendar = (task: AnalyzedTask) =>
  task.final_importance === "critical" || task.final_importance === "major";

const inRange = (date: string | null | undefined, start: string, end: string) =>
  Boolean(date && date >= start && date <= end);

export function formatWeekDayLabel(dateStr: string, today = localDateString()): string {
  if (dateStr === today) return "Today";
  if (dateStr === addDaysToDateString(today, 1)) return "Tomorrow";
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatWeekTime(time?: string | null): string | null {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  const hour = Number(match[1]);
  const minute = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${minute} ${ampm}`;
}

/** Critical/major calendar items and important goals from today through the next 6 days. */
export function collectImportantWeekTasks(
  tasks: AnalyzedTask[],
  goals: GoalWithProgress[] = [],
  today = localDateString(),
  nowHHMM?: string | null,
): WeekPriorityItem[] {
  const weekEnd = addDaysToDateString(today, 6);
  const nowMinutes = parseHHMMMinutes(nowHHMM);
  const items: WeekPriorityItem[] = [];
  const seen = new Set<string>();

  const add = (item: WeekPriorityItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  for (const task of tasks) {
    if (!isImportantCalendar(task)) continue;
    if (eventHasEnded(task, today, nowMinutes)) continue;
    if (task.date && task.date < today) continue;

    if (inRange(task.date, today, weekEnd) && task.date) {
      const happeningNow = eventIsHappening(task, today, nowMinutes);
      add({
        id: task.id,
        title: task.title,
        date: task.date,
        time: task.startTime,
        endTime: task.endTime,
        importance: task.final_importance,
        kind: "event",
        happeningNow,
        remainingMinutes:
          happeningNow && nowMinutes !== null
            ? remainingMinutesUntil(task.endTime, nowMinutes) ?? undefined
            : undefined,
      });
    }

    if (
      inRange(task.recommended_start_date, today, weekEnd) &&
      task.recommended_start_date &&
      (!task.date || task.recommended_start_date < task.date)
    ) {
      add({
        id: `${task.id}-prep`,
        title: `Prep: ${task.title}`,
        date: task.recommended_start_date,
        importance: task.final_importance,
        kind: "prep",
      });
    }
  }

  for (const goal of goals) {
    if (!goal.is_active || isGoalComplete(goal)) continue;
    if (normalizeGoalUrgency(goal.urgency) !== "important") continue;
    const deadline = goal.end_date?.slice(0, 10) ?? null;
    if (!deadline) continue;
    const days = daysUntilDeadline(deadline);
    if (days < 0 || days > 6) continue;
    add({
      id: `goal-${goal.id}`,
      title: `🎯 ${goal.title}`,
      date: deadline,
      importance: "major",
      kind: "goal",
    });
  }

  return items.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    if (Boolean(a.happeningNow) !== Boolean(b.happeningNow)) return a.happeningNow ? -1 : 1;
    const byImportance = IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
    if (byImportance !== 0) return byImportance;
    return (a.time || "99:99").localeCompare(b.time || "99:99");
  });
}

export function groupImportantWeekTasks(
  items: WeekPriorityItem[],
  today = localDateString(),
): WeekPriorityGroup[] {
  const map = new Map<string, WeekPriorityItem[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return [...map.entries()].map(([date, grouped]) => ({
    date,
    label: formatWeekDayLabel(date, today),
    items: grouped,
  }));
}
