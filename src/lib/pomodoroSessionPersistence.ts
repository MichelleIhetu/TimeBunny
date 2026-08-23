import type { ScheduleItem } from "@/types/schedule";

const POMODORO_SESSION_KEY = "timebunny_pomodoro_session";

export interface PomodoroSessionSnapshot {
  taskId: string;
  taskTitle: string;
  taskTime: string;
  timerSeconds: number;
  timerDuration: number;
  timerRunning: boolean;
  savedAt: string;
}

export function savePomodoroSession(snapshot: PomodoroSessionSnapshot): void {
  try {
    sessionStorage.setItem(POMODORO_SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPomodoroSession(): PomodoroSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(POMODORO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PomodoroSessionSnapshot;
    if (
      !parsed?.taskId ||
      typeof parsed.timerSeconds !== "number" ||
      typeof parsed.timerDuration !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPomodoroSession(): void {
  try {
    sessionStorage.removeItem(POMODORO_SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Remaining seconds, accounting for time elapsed while away (e.g. during vibe check). */
export function computeRemainingSeconds(snapshot: PomodoroSessionSnapshot): number {
  if (!snapshot.timerRunning) return Math.max(0, snapshot.timerSeconds);
  const elapsedSec = (Date.now() - new Date(snapshot.savedAt).getTime()) / 1000;
  return Math.max(0, Math.floor(snapshot.timerSeconds - elapsedSec));
}

export function findTaskForSession(
  schedule: ScheduleItem[],
  session: PomodoroSessionSnapshot,
): ScheduleItem | null {
  const byId = schedule.find((t) => t.id === session.taskId);
  if (byId) return byId;

  const byTitleAndTime = schedule.find(
    (t) => t.title === session.taskTitle && t.time === session.taskTime,
  );
  if (byTitleAndTime) return byTitleAndTime;

  return schedule.find((t) => t.title === session.taskTitle) ?? null;
}
