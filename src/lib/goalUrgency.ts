import { localDateString, parseLocalDate } from "@/lib/localTime";

export type GoalUrgency = "minor" | "important";

export function normalizeGoalUrgency(value?: string | null): GoalUrgency {
  return value === "important" ? "important" : "minor";
}

/** Days left until end_date (inclusive of today), minimum 0. */
export function daysUntilDeadline(endDateStr: string): number {
  const today = parseLocalDate(localDateString());
  const end = parseLocalDate(endDateStr.slice(0, 10));
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/**
 * 0–100 score rising as the deadline approaches (or overdue).
 * Used to ramp schedule gap-filling near due dates.
 */
export function deadlineProximityScore(endDate: string | null | undefined): number {
  if (!endDate) return 0;
  const days = daysUntilDeadline(endDate);
  if (days < 0) return 100;
  if (days === 0) return 95;
  if (days <= 2) return 85;
  if (days <= 7) return 65;
  if (days <= 14) return 40;
  if (days <= 30) return 20;
  return 5;
}

/**
 * Higher = fill schedule gaps sooner. Important goals weigh deadline proximity fully;
 * minor goals only pick up a fraction unless the deadline is very close.
 */
export function goalSchedulePriority(goal: {
  urgency?: string | null;
  end_date?: string | null;
}): number {
  const urgency = normalizeGoalUrgency(goal.urgency);
  const proximity = deadlineProximityScore(goal.end_date);
  const base = urgency === "important" ? 35 : 8;
  const proximityWeight = urgency === "important" ? 1 : proximity >= 85 ? 0.6 : 0.25;
  return base + proximity * proximityWeight;
}

export function urgencyLabel(urgency: GoalUrgency): string {
  return urgency === "important" ? "Important" : "Minor";
}
