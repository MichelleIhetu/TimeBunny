import type { GoalWithProgress } from "@/hooks/useGoals";
import { isGoalComplete } from "@/lib/goalCarrots";
import {
  formatGoalProgress,
  goalProgressSubtitle,
  isBookCompletionUnit,
  normalizeGoalUnit,
  remainingHoursEquivalent,
} from "@/lib/goalUnits";
import { DEFAULT_SCHEDULE_SUIT, type ScheduleItem, type Suit } from "@/types/schedule";

export type GoalForSchedule = {
  id: string;
  title: string;
  category: string;
  goal_type: "monthly" | "ongoing";
  target_hours: number;
  target_unit: string;
  totalLogged: number;
  remainingHours: number;
  suggestedDailyMinutes: number;
  streak: number;
};

export type GoalSuggestion = {
  goalTitle: string;
  goalId?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  activity: string;
  reason: string;
  category?: string;
};

const categoryToSuit = (_category?: string): Suit => DEFAULT_SCHEDULE_SUIT;

export const formatGoalsForSchedule = (goals: GoalWithProgress[]): GoalForSchedule[] => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1);

  return goals.filter((g) => !isGoalComplete(g)).map((g) => {
    const unit = normalizeGoalUnit(g.target_unit);
    const bookCompletion = isBookCompletionUnit(unit);
    const remainingHours = remainingHoursEquivalent(g.totalLogged, g.target_hours, unit);
    const remainingAmount = Math.max(0, g.target_hours - g.totalLogged);
    const suggestedDailyMinutes = bookCompletion
      ? Math.min(
          60,
          Math.max(
            15,
            unit === "pages"
              ? Math.ceil(Math.min(remainingAmount * 2, 45))
              : Math.ceil(Math.min(remainingAmount * 20, 45)),
          ),
        )
      : g.goal_type === "monthly"
        ? Math.min(60, Math.max(15, Math.ceil((remainingHours * 60) / daysLeftInMonth)))
        : Math.min(45, Math.max(15, Math.ceil(remainingHours > 0 ? 30 : 15)));

    return {
      id: g.id,
      title: g.title,
      category: g.category,
      goal_type: g.goal_type,
      target_hours: g.target_hours,
      target_unit: unit,
      totalLogged: g.totalLogged,
      remainingHours,
      suggestedDailyMinutes,
      streak: g.streak,
    };
  });
};

export const buildGoalsSchedulePrompt = (goals: GoalForSchedule[]): string => {
  if (goals.length === 0) return "";

  const lines = goals.map((g) => {
    const progressLabel = isBookCompletionUnit(g.target_unit)
      ? `${formatGoalProgress(g.totalLogged, g.target_hours, g.target_unit)} complete`
      : `${formatGoalProgress(g.totalLogged, g.target_hours, g.target_unit)} done (${g.remainingHours.toFixed(1)}h left)`;
    return `- 🎯 "${g.title}" (${g.category}, ${progressLabel}, streak ${g.streak}d) → schedule ~${g.suggestedDailyMinutes} min today`;
  });

  return `\n\n🎯 LONG-TERM GOALS — MUST INCLUDE IN TODAY'S SCHEDULE:
${lines.join("\n")}

Goal scheduling rules:
- Each active goal above MUST receive at least one dedicated block today (use 🎯 prefix in the task title).
- Place blocks in gaps between fixed calendar events; never overlap [FIXED] items.
- Fitness goals → morning slots when possible; creative → evening; learning → afternoon focus windows.
- Use Atomic Habits: keep blocks small (15–45 min) and stack after existing habits when sensible.`;
};

export const goalSuggestionsToScheduleItems = (suggestions: GoalSuggestion[]): ScheduleItem[] =>
  suggestions.map((s, index) => ({
    id: `goal-block-${s.goalId ?? index}-${s.startTime.replace(":", "")}`,
    title: `🎯 ${s.activity}`,
    time: s.startTime,
    endTime: s.endTime,
    description: `Goal: ${s.goalTitle}${s.reason ? ` — ${s.reason}` : ""}`,
    suit: categoryToSuit(s.category),
    goalId: s.goalId,
  }));

const parseTimeToMinutes = (time: string): number | null => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const formatTimeMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const MAX_INFERRED_GAP_MINUTES = 120;
const MAX_FOCUS_BLOCK_MINUTES = 90;
const MAX_RELAX_BLOCK_MINUTES = 45;
const DEFAULT_FOCUS_BLOCK_MINUTES = 30;
const DEFAULT_RELAX_BLOCK_MINUTES = 25;

export function isRelaxationBlock(title: string): boolean {
  const t = title.toLowerCase();
  return /\b(break|wind\s*down|winding\s*down|relax|bedtime|sleep|rest|decompress|unwind)\b/.test(t);
}

export type ScheduleTimingContext = {
  bedTime?: string;
};

export const getItemDurationMinutes = (
  item: ScheduleItem,
  schedule: ScheduleItem[],
  context?: ScheduleTimingContext,
): number => {
  const relaxation = isRelaxationBlock(item.title);
  const maxBlock = relaxation ? MAX_RELAX_BLOCK_MINUTES : MAX_FOCUS_BLOCK_MINUTES;
  const defaultBlock = relaxation ? DEFAULT_RELAX_BLOCK_MINUTES : DEFAULT_FOCUS_BLOCK_MINUTES;

  const start = parseTimeToMinutes(item.time);
  if (start === null) return defaultBlock;

  if (item.endTime) {
    const end = parseTimeToMinutes(item.endTime);
    if (end !== null) {
      let duration = end - start;
      if (duration <= 0) duration += 24 * 60;
      if (duration > 0 && duration <= maxBlock * 2) {
        return Math.min(duration, maxBlock);
      }
    }
  }

  const sorted = [...schedule].sort((a, b) => a.time.localeCompare(b.time));
  const idx = sorted.findIndex((s) => s.id === item.id);

  if (idx >= 0 && idx < sorted.length - 1) {
    const nextStart = parseTimeToMinutes(sorted[idx + 1].time);
    if (nextStart !== null) {
      let gap = nextStart - start;
      if (gap <= 0) gap += 24 * 60;
      if (gap > 0 && gap <= MAX_INFERRED_GAP_MINUTES) {
        return Math.min(gap, maxBlock);
      }
    }
  }

  if (context?.bedTime) {
    const bed = parseTimeToMinutes(context.bedTime);
    if (bed !== null) {
      let untilBed = bed - start;
      if (untilBed <= 0) untilBed += 24 * 60;
      if (untilBed > 0 && untilBed <= 180) {
        return Math.min(untilBed, maxBlock);
      }
    }
  }

  return defaultBlock;
};

export function getPomodoroDurationSeconds(
  item: ScheduleItem,
  schedule: ScheduleItem[],
  context?: ScheduleTimingContext,
): number {
  return getItemDurationMinutes(item, schedule, context) * 60;
}

export function formatPomodoroTimer(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const isGoalScheduleItem = (item: ScheduleItem): boolean =>
  Boolean(item.goalId) || item.title.includes("🎯") || /^Goal:/i.test(item.description ?? "");

export const resolveGoalIdFromItem = (
  item: ScheduleItem,
  goals: Array<{ id: string; title: string }>,
): string | undefined => {
  if (item.goalId) return item.goalId;
  const normalizedTitle = item.title.replace(/^🎯\s*/, "").trim().toLowerCase();
  const match = goals.find((g) => {
    const goalTitle = g.title.toLowerCase();
    return normalizedTitle.includes(goalTitle) || goalTitle.includes(normalizedTitle);
  });
  if (match) return match.id;
  const desc = item.description ?? "";
  const descMatch = desc.match(/Goal:\s*([^—]+)/i);
  if (descMatch) {
    const goalTitle = descMatch[1].trim().toLowerCase();
    return goals.find((g) => g.title.toLowerCase() === goalTitle)?.id;
  }
  return undefined;
};

const scheduleCoversGoal = (schedule: ScheduleItem[], goal: GoalForSchedule): boolean =>
  schedule.some((item) => {
    if (item.goalId === goal.id) return true;
    const title = item.title.toLowerCase();
    return title.includes("🎯") && title.includes(goal.title.toLowerCase());
  });

const gapScoreForCategory = (gapStartMinutes: number, category: string): number => {
  const hour = Math.floor(gapStartMinutes / 60);
  switch (category) {
    case "fitness":
      return hour < 12 ? 10 : hour < 17 ? 5 : 2;
    case "learning":
      return hour >= 13 && hour < 17 ? 10 : hour >= 9 && hour < 12 ? 7 : 4;
    case "creative":
      return hour >= 18 ? 10 : hour >= 15 ? 6 : 3;
    case "career":
      return hour >= 9 && hour < 17 ? 10 : 4;
    case "wellness":
      return hour >= 7 && hour < 9 ? 8 : hour >= 12 && hour < 14 ? 8 : 5;
    case "reading":
      return hour >= 19 ? 10 : hour >= 12 && hour < 15 ? 8 : hour >= 7 && hour < 9 ? 7 : 5;
    default:
      return 5;
  }
};

export const findScheduleGaps = (
  schedule: ScheduleItem[],
  dayStartMinutes: number,
  dayEndMinutes: number,
  minGapMinutes = 15,
): Array<{ start: number; end: number }> => {
  const sorted = [...schedule].sort((a, b) => a.time.localeCompare(b.time));
  const occupied: Array<{ start: number; end: number }> = sorted.flatMap((item, idx) => {
    const start = parseTimeToMinutes(item.time);
    if (start === null) return [];

    let end: number | null = item.endTime ? parseTimeToMinutes(item.endTime) : null;
    if (end === null && idx < sorted.length - 1) {
      end = parseTimeToMinutes(sorted[idx + 1].time);
    }
    if (end === null) {
      end = start + getItemDurationMinutes(item, schedule);
    }
    if (end <= start) end = start + 30;
    return [{ start, end }];
  });

  occupied.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const block of occupied) {
    const last = merged[merged.length - 1];
    if (!last || block.start > last.end) merged.push({ ...block });
    else last.end = Math.max(last.end, block.end);
  }

  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = dayStartMinutes;
  for (const block of merged) {
    if (block.start - cursor >= minGapMinutes) gaps.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (dayEndMinutes - cursor >= minGapMinutes) gaps.push({ start: cursor, end: dayEndMinutes });
  return gaps;
};

export const attachGoalIdsToSchedule = (
  schedule: ScheduleItem[],
  goals: GoalForSchedule[],
): ScheduleItem[] =>
  schedule.map((item) => {
    if (item.goalId) return item;
    const goalId = resolveGoalIdFromItem(item, goals);
    return goalId ? { ...item, goalId } : item;
  });

export const schedulesEquivalent = (a: ScheduleItem[], b: ScheduleItem[]): boolean => {
  if (a.length !== b.length) return false;
  const key = (items: ScheduleItem[]) =>
    [...items]
      .sort((x, y) => x.time.localeCompare(y.time))
      .map((i) => `${i.time}|${i.title}|${i.goalId ?? ""}`)
      .join(";");
  return key(a) === key(b);
};

export const mergeScheduleItems = (existing: ScheduleItem[], additions: ScheduleItem[]): ScheduleItem[] => {
  const byKey = new Map<string, ScheduleItem>();
  for (const item of existing) byKey.set(`${item.time}-${item.title}`, item);
  for (const item of additions) byKey.set(`${item.time}-${item.title}`, item);
  return [...byKey.values()].sort((a, b) => a.time.localeCompare(b.time));
};

/** Drop schedule blocks tied to goals that are already complete. */
export const removeCompletedGoalBlocks = (
  schedule: ScheduleItem[],
  goals: GoalWithProgress[],
): ScheduleItem[] => {
  const completedIds = new Set(goals.filter(isGoalComplete).map((g) => g.id));
  if (completedIds.size === 0) return schedule;

  return schedule.filter((item) => {
    if (!isGoalScheduleItem(item)) return true;
    const goalId = item.goalId ?? resolveGoalIdFromItem(item, goals);
    return !goalId || !completedIds.has(goalId);
  });
};

/** Insert goal blocks into free gaps for goals not yet on today's schedule. */
export const fillGoalGapsInSchedule = (
  schedule: ScheduleItem[],
  goals: GoalForSchedule[],
  settings: { wakeTime: string; bedTime: string },
): ScheduleItem[] => {
  if (goals.length === 0) return schedule;

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const wakeMinutes = parseTimeToMinutes(settings.wakeTime);
  const dayEnd = parseTimeToMinutes(settings.bedTime);
  if (wakeMinutes === null || dayEnd === null) return attachGoalIdsToSchedule(schedule, goals);
  const dayStart = Math.max(wakeMinutes, nowMinutes);
  if (dayEnd <= dayStart) return attachGoalIdsToSchedule(schedule, goals);

  let working = attachGoalIdsToSchedule(schedule, goals);
  const additions: ScheduleItem[] = [];

  for (const goal of goals) {
    if (scheduleCoversGoal(working, goal)) continue;

    const blockMinutes = Math.min(goal.suggestedDailyMinutes, 45);
    const gaps = findScheduleGaps(working, dayStart, dayEnd, blockMinutes);
    const scored = gaps
      .filter((g) => g.end - g.start >= blockMinutes)
      .map((g) => ({
        gap: g,
        score: gapScoreForCategory(g.start, goal.category) + (g.end - g.start) / 120,
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) continue;

    const { gap } = scored[0];
    const start = gap.start;
    const end = start + blockMinutes;
    const newItem: ScheduleItem = {
      id: `goal-auto-${goal.id}-${formatTimeMinutes(start).replace(":", "")}`,
      title: `🎯 ${goal.title}`,
      time: formatTimeMinutes(start),
      endTime: formatTimeMinutes(end),
      description: `Goal progress — ${goal.category}`,
      suit: categoryToSuit(goal.category),
      goalId: goal.id,
    };

    additions.push(newItem);
    working = mergeScheduleItems(working, [newItem]);
  }

  if (additions.length === 0) return working;
  return mergeScheduleItems(schedule, additions).map((item) => {
    if (item.goalId) return item;
    const goalId = resolveGoalIdFromItem(item, goals);
    return goalId ? { ...item, goalId } : item;
  });
};

export const countNewScheduleItems = (before: ScheduleItem[], after: ScheduleItem[]): number =>
  after.filter((item) => !before.some((b) => b.id === item.id)).length;

export const goalsToTaskLines = (goals: GoalForSchedule[]): string =>
  goals
    .map(
      (g) =>
        `- 🎯 ${g.title} (${g.category}) — ${g.suggestedDailyMinutes} min daily progress block 🔴 HIGH PRIORITY`,
    )
    .join("\n");
