export type GoalTargetUnit = "hours" | "minutes" | "pages" | "chapters";

export const GOAL_TARGET_UNITS: { value: GoalTargetUnit; label: string; short: string }[] = [
  { value: "hours", label: "Hours", short: "h" },
  { value: "minutes", label: "Minutes", short: "min" },
  { value: "pages", label: "Pages", short: "pg" },
  { value: "chapters", label: "Chapters", short: "ch" },
];

export const READING_TARGET_UNITS = GOAL_TARGET_UNITS;

export function isReadingCategory(category: string): boolean {
  return category === "reading";
}

export function normalizeGoalUnit(unit?: string | null): GoalTargetUnit {
  if (unit === "minutes" || unit === "pages" || unit === "chapters") return unit;
  return "hours";
}

export function formatGoalAmount(value: number, unit: GoalTargetUnit): string {
  if (unit === "hours") return value % 1 === 0 ? String(value) : value.toFixed(1);
  if (unit === "minutes") return String(Math.round(value));
  return String(Math.round(value));
}

export function isBookCompletionUnit(unit?: string | null): boolean {
  const u = normalizeGoalUnit(unit);
  return u === "pages" || u === "chapters";
}

export function formatGoalProgress(
  totalLogged: number,
  target: number,
  unit?: string | null,
): string {
  const u = normalizeGoalUnit(unit);
  const short = GOAL_TARGET_UNITS.find((x) => x.value === u)?.short ?? "h";
  return `${formatGoalAmount(totalLogged, u)}${short} / ${formatGoalAmount(target, u)}${short}`;
}

export function goalProgressSubtitle(unit?: string | null, goalType?: string): string {
  if (isBookCompletionUnit(unit)) return "book completion";
  return goalType ?? "ongoing";
}

export function targetLabel(unit: GoalTargetUnit, goalType: "monthly" | "ongoing"): string {
  if (unit === "pages") return "TOTAL PAGES IN BOOK";
  if (unit === "chapters") return "TOTAL CHAPTERS IN BOOK";
  const period = goalType === "monthly" ? "/MONTH" : " TOTAL";
  const labels: Record<GoalTargetUnit, string> = {
    hours: `TARGET HOURS${period}`,
    minutes: `TARGET MINUTES${period}`,
    pages: `TOTAL PAGES IN BOOK`,
    chapters: `TOTAL CHAPTERS IN BOOK`,
  };
  return labels[unit];
}

export function logPlaceholder(unit: GoalTargetUnit): string {
  const labels: Record<GoalTargetUnit, string> = {
    hours: "hours read today",
    minutes: "minutes read today",
    pages: "pages read today",
    chapters: "chapters read today",
  };
  return labels[unit];
}

export function logStep(unit: GoalTargetUnit): string {
  if (unit === "hours") return "0.25";
  if (unit === "minutes") return "5";
  return "1";
}

export function defaultTargetForUnit(unit: GoalTargetUnit): string {
  const defaults: Record<GoalTargetUnit, string> = {
    hours: "10",
    minutes: "600",
    pages: "300",
    chapters: "20",
  };
  return defaults[unit];
}

/** Convert remaining goal amount to hours for schedule time-block suggestions. */
export function remainingHoursEquivalent(
  totalLogged: number,
  target: number,
  unit?: string | null,
): number {
  const remaining = Math.max(0, target - totalLogged);
  const u = normalizeGoalUnit(unit);
  switch (u) {
    case "minutes":
      return remaining / 60;
    case "pages":
      return (remaining * 2) / 60;
    case "chapters":
      return (remaining * 20) / 60;
    default:
      return remaining;
  }
}

export function progressPercent(totalLogged: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min((totalLogged / target) * 100, 100);
}
