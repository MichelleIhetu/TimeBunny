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

/** Soft kawaii chime — one pass (~1.5s). */
export const TIMER_UP_CHIME_VOLUME = 0.2;
export const TIMER_UP_ALARM_DURATION_MS = 90_000;
const TIMER_UP_CHIME_LOOP_MS = 1_700;

let timerUpAlarmInterval: ReturnType<typeof setInterval> | null = null;
let timerUpAlarmTimeout: ReturnType<typeof setTimeout> | null = null;
let timerUpAlarmContext: AudioContext | null = null;

function playTimerUpChimeOnce(ctx: AudioContext, volume = TIMER_UP_CHIME_VOLUME) {
  const now = ctx.currentTime;
  const notes = [
    { freq: 988, at: 0, hold: 0.5 },
    { freq: 1175, at: 0.14, hold: 0.5 },
    { freq: 1319, at: 0.28, hold: 0.55 },
    { freq: 1568, at: 0.42, hold: 0.7 },
    { freq: 1760, at: 0.58, hold: 0.85 },
  ];

  notes.forEach(({ freq, at, hold }) => {
    const t = now + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + hold);
    osc.start(t);
    osc.stop(t + hold + 0.05);
  });
}

/** Stop the extended timer-up alarm (Session Done, Stop, etc.). */
export function stopTimerUpAlarm() {
  if (timerUpAlarmInterval) {
    clearInterval(timerUpAlarmInterval);
    timerUpAlarmInterval = null;
  }
  if (timerUpAlarmTimeout) {
    clearTimeout(timerUpAlarmTimeout);
    timerUpAlarmTimeout = null;
  }
  if (timerUpAlarmContext) {
    void timerUpAlarmContext.close().catch(() => {});
    timerUpAlarmContext = null;
  }
}

/** Louder kawaii chime loop — plays ~1 min 30 sec unless stopped early. */
export function startTimerUpAlarm() {
  stopTimerUpAlarm();
  try {
    const ctx = new AudioContext();
    timerUpAlarmContext = ctx;
    playTimerUpChimeOnce(ctx);
    timerUpAlarmInterval = setInterval(() => {
      if (timerUpAlarmContext) playTimerUpChimeOnce(timerUpAlarmContext);
    }, TIMER_UP_CHIME_LOOP_MS);
    timerUpAlarmTimeout = setTimeout(() => stopTimerUpAlarm(), TIMER_UP_ALARM_DURATION_MS);
  } catch {
    /* audio blocked */
  }
}

/** Single chime — preview / one-shot use. */
export function playTimerUpChime() {
  try {
    const ctx = new AudioContext();
    playTimerUpChimeOnce(ctx);
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
