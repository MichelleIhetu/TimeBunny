import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { CalendarEvent } from "@/lib/calendarSync";
import type { GoalWithProgress } from "@/hooks/useGoals";
import type { ScheduleItem } from "@/types/schedule";

export type CalendarItemKind = "event" | "deadline" | "task" | "prep";

export interface CalendarDayItem {
  id: string;
  date: string;
  title: string;
  kind: CalendarItemKind;
  time?: string;
  endTime?: string;
  importance?: AnalyzedTask["final_importance"];
  category?: string;
}

export const kindColors: Record<CalendarItemKind, string> = {
  event: "#7c3aed",
  deadline: "#ec4899",
  task: "#16a34a",
  prep: "#0d9488",
};

export const kindLabels: Record<CalendarItemKind, string> = {
  event: "Event",
  deadline: "Deadline",
  task: "Task",
  prep: "Prep",
};

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: Date[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  while (days.length % 7 !== 0) {
    const next = days.length - startPad - last.getDate() + 1;
    days.push(new Date(year, month + 1, next));
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function buildMonthlyCalendarItems(opts: {
  calendarTasks?: AnalyzedTask[];
  rawEvents?: CalendarEvent[];
  goals?: GoalWithProgress[];
  schedule?: ScheduleItem[];
  scheduleDate?: string;
}): CalendarDayItem[] {
  const items: CalendarDayItem[] = [];
  const seen = new Set<string>();
  const add = (item: CalendarDayItem) => {
    const key = `${item.kind}:${item.id}:${item.date}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const task of opts.calendarTasks ?? []) {
    if (task.date) {
      add({
        id: task.id,
        date: task.date,
        title: task.title,
        kind: "event",
        time: task.startTime ?? undefined,
        endTime: task.endTime ?? undefined,
        importance: task.final_importance,
        category: task.final_category,
      });
    }
    if (task.recommended_start_date) {
      add({
        id: `${task.id}-prep`,
        date: task.recommended_start_date,
        title: `Prep: ${task.title}`,
        kind: "prep",
        category: task.final_category,
        importance: task.final_importance,
      });
    }
  }

  for (const event of opts.rawEvents ?? []) {
    if (!event.date) continue;
    add({
      id: event.id,
      date: event.date,
      title: event.title,
      kind: "event",
      time: event.startTime,
      endTime: event.endTime,
    });
  }

  for (const goal of opts.goals ?? []) {
    if (goal.end_date) {
      add({
        id: `${goal.id}-deadline`,
        date: goal.end_date.slice(0, 10),
        title: goal.title,
        kind: "deadline",
        category: goal.category,
      });
    }
    if (goal.start_date) {
      add({
        id: `${goal.id}-start`,
        date: goal.start_date.slice(0, 10),
        title: `${goal.title} (goal start)`,
        kind: "deadline",
        category: goal.category,
      });
    }
  }

  const scheduleDate = opts.scheduleDate ?? toDateKey(new Date());
  for (const block of opts.schedule ?? []) {
    add({
      id: `schedule-${block.id}`,
      date: scheduleDate,
      title: block.title,
      kind: "task",
      time: block.time,
      endTime: block.endTime,
    });
  }

  return items.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (a.time || "").localeCompare(b.time || "");
  });
}

export function groupItemsByDate(items: CalendarDayItem[]): Map<string, CalendarDayItem[]> {
  const map = new Map<string, CalendarDayItem[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return map;
}
