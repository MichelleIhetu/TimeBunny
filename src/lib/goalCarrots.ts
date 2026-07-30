import type { GoalWithProgress } from "@/hooks/useGoals";
import { progressPercent } from "@/lib/goalUnits";

const CELEBRATED_KEY = "timebunny_goal_carrot_celebrated";

export function isGoalComplete(goal: GoalWithProgress): boolean {
  return progressPercent(goal.totalLogged, goal.target_hours) >= 100;
}

export function loadCelebratedGoalIds(userId?: string): Set<string> {
  if (!userId || typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${CELEBRATED_KEY}_${userId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveCelebratedGoalIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`${CELEBRATED_KEY}_${userId}`, JSON.stringify([...ids]));
  } catch {}
}

export function countCompletedGoals(goals: GoalWithProgress[]): number {
  return goals.filter(isGoalComplete).length;
}

/** Lifetime harvest count — persisted per user, includes archived goals once celebrated. */
export function countHarvestedCarrots(userId?: string, goals: GoalWithProgress[] = []): number {
  const celebrated = loadCelebratedGoalIds(userId).size;
  const activeComplete = countCompletedGoals(goals);
  return Math.max(celebrated, activeComplete);
}
