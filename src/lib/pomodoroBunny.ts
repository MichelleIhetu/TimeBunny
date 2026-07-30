import type { ScheduleItem } from "@/types/schedule";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";

export const POMODORO_ENCOURAGEMENT_MESSAGES = [
  "You're doing great — keep going!",
  "Deep breath. You've got this.",
  "One step at a time. Proud of you.",
  "Stay focused — you're making progress.",
  "Almost there. Keep that momentum!",
  "You're stronger than you think.",
  "Nice work staying on track.",
  "This is your time. Use it well.",
  "Believe in yourself — I do.",
  "Steady and strong. Keep it up!",
];

export const CRITICAL_VICTORY_MESSAGES = [
  "CRITICAL TASK CRUSHED! You are unstoppable!",
  "That was the big one — incredible work!",
  "Victory! You handled what mattered most!",
  "Essential task: DONE. You're a champion!",
];

export function randomEncouragementIntervalMs(): number {
  const minMs = 15 * 60 * 1000;
  const maxMs = 20 * 60 * 1000;
  return minMs + Math.random() * (maxMs - minMs);
}

export function pickEncouragementMessage(): string {
  return POMODORO_ENCOURAGEMENT_MESSAGES[
    Math.floor(Math.random() * POMODORO_ENCOURAGEMENT_MESSAGES.length)
  ];
}

export function pickCriticalVictoryMessage(): string {
  return CRITICAL_VICTORY_MESSAGES[Math.floor(Math.random() * CRITICAL_VICTORY_MESSAGES.length)];
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

/** Detect whether a completed schedule block counts as a critical task. */
export function isCriticalScheduleTask(
  item: ScheduleItem,
  calendarAnalysis: AnalyzedTask[],
  comfortMode: "critical_only" | null,
): boolean {
  if (comfortMode === "critical_only") return true;

  const blob = `${item.title} ${item.description ?? ""}`.toLowerCase();
  if (/\bcritical\b|\[fixed\]|deadline|due today|must.?do|essential|urgent/i.test(blob)) {
    return true;
  }

  return calendarAnalysis.some(
    (t) => t.final_importance === "critical" && titlesMatch(item.title, t.title),
  );
}

/** Bright, high-pitch encouragement chime. */
export function playEncouragementChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [1760, 2093, 2637, 3136].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const t = now + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch {
    /* audio blocked */
  }
}

/** Triumphant fanfare for critical task completion. */
export function playCriticalVictoryFanfare() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [1568, 1976, 2349, 2793, 3136, 3520].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = i % 2 === 0 ? "triangle" : "sine";
      const t = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    /* audio blocked */
  }
}

export function playCompletionDing() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [1318, 1568, 2093, 2637].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const offset = i * 0.1;
      osc.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.25, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.8);
      osc.start(now + offset);
      osc.stop(now + offset + 0.8);
    });
  } catch {
    /* audio blocked */
  }
}
