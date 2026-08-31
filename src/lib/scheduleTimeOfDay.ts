import { DEFAULT_SCHEDULE_SUIT, type ScheduleItem } from "@/types/schedule";
import { isFixedCalendarBlock } from "@/lib/goalsSchedule";

export type TimeOfDayContext = {
  wakeTime?: string;
  bedTime?: string;
  nowHHMM?: string;
};

type Ritual = "wake" | "breakfast" | "lunch" | "dinner" | "winddown" | "sleep";

const parseHHMM = (time: string | undefined): number | null => {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const hour = (minutes: number): number => minutes / 60;

/** Symbolic classifier: what kind of day-part ritual the title claims to be. */
export function classifyDayRitual(title: string, description?: string): Ritual | null {
  const t = `${title} ${description ?? ""}`.toLowerCase();

  if (
    /\b(lights\s*out|good\s*night|go(?:ing)? to bed|get ready for bed|ready for bed|sleep(?:ing)?(?:\s*time)?)\b/.test(
      t,
    )
  ) {
    return "sleep";
  }
  if (
    /\b(wind[\s-]*down|winding[\s-]*down|retire(?:s|d)?(?:\s+for(?:\s+the)?\s+night)?|turn in)\b/.test(t)
  ) {
    return "winddown";
  }
  if (
    /\b((?:gentle\s+)?awaken(?:ing)?|wake(?:\s*up)?|waking(?:\s+up)?|rise and shine|good morning|morning routine|start (?:the|your) day|get ready for (?:the )?day|morning stretch|sunrise)\b/.test(
      t,
    )
  ) {
    return "wake";
  }
  if (/\bbreakfast\b|\bmorning meal\b/.test(t)) return "breakfast";
  if (/\blunch\b|\bmidday meal\b/.test(t)) return "lunch";
  if (/\bdinner\b|\bsupper\b|\bevening meal\b/.test(t)) return "dinner";
  return null;
}

const wakeWindowEnd = (wake: number | null): number => {
  const fromWake = wake !== null ? wake + 120 : 10 * 60 + 30;
  return Math.min(fromWake, 10 * 60 + 30);
};

const isInWakeWindow = (start: number, wake: number | null): boolean => {
  const begin = wake !== null ? Math.max(0, wake - 20) : 5 * 60;
  return start >= begin && start < wakeWindowEnd(wake);
};

const isNearBed = (start: number, bed: number | null, minutesBefore = 150): boolean => {
  if (bed !== null) return start >= bed - minutesBefore;
  return start >= 20 * 60;
};

const mealTitleForTime = (start: number): string => {
  const h = hour(start);
  if (h < 10.5) return "Breakfast";
  if (h < 11.5) return "Brunch";
  if (h < 15) return "Lunch";
  if (h < 17) return "Afternoon snack";
  if (h < 21) return "Dinner";
  return "Evening snack";
};

const breakTitleForTime = (start: number): string => {
  const h = hour(start);
  if (h < 12) return "Morning break";
  if (h < 17) return "Afternoon break";
  return "Evening break";
};

const withFlavorPrefix = (originalTitle: string, nextTitle: string): string => {
  const match = originalTitle.match(/^(.+?)\s*[:—–-]\s+(.+)$/);
  if (match && /rabbit|wonderland|tweedle|alice|tea party|mad hatter/i.test(match[1])) {
    return `${match[1].trim()}: ${nextTitle}`;
  }
  return nextTitle;
};

const retitle = (item: ScheduleItem, nextTitle: string, description?: string): ScheduleItem => ({
  ...item,
  title: withFlavorPrefix(item.title, nextTitle),
  description: description ?? item.description,
  suit: item.suit ?? DEFAULT_SCHEDULE_SUIT,
});

/**
 * Neurosymbolic pass: titles must match the clock.
 * Neural layer names the block; this symbolic layer rejects "gentle awakening" at 2pm.
 */
export function alignScheduleToTimeOfDay(
  schedule: ScheduleItem[],
  ctx: TimeOfDayContext = {},
): ScheduleItem[] {
  const wake = parseHHMM(ctx.wakeTime);
  const bed = parseHHMM(ctx.bedTime);
  const now = parseHHMM(ctx.nowHHMM);

  return schedule.flatMap((item) => {
    if (isFixedCalendarBlock(item)) return [item];
    const start = parseHHMM(item.time);
    if (start === null) return [item];
    // Don't rewrite history — past blocks already happened.
    if (now !== null && start < now) return [item];

    const ritual = classifyDayRitual(item.title, item.description);
    if (!ritual) return [item];

    if (ritual === "wake") {
      if (isInWakeWindow(start, wake)) return [item];
      return [];
    }

    if (ritual === "breakfast") {
      if (hour(start) < 10.75) return [item];
      return [retitle(item, mealTitleForTime(start))];
    }

    if (ritual === "lunch") {
      if (hour(start) >= 11 && hour(start) < 15) return [item];
      return [retitle(item, mealTitleForTime(start))];
    }

    if (ritual === "dinner") {
      if (hour(start) >= 16.5 && hour(start) < 21.5) return [item];
      return [retitle(item, mealTitleForTime(start))];
    }

    if (ritual === "winddown") {
      if (isNearBed(start, bed, 150)) return [item];
      return [
        retitle(
          item,
          breakTitleForTime(start),
          "A recharge break — wind-down belongs near bedtime.",
        ),
      ];
    }

    if (ritual === "sleep") {
      if (isNearBed(start, bed, 60)) return [item];
      return [
        retitle(
          item,
          breakTitleForTime(start),
          "A rest break — bedtime belongs at the end of the day.",
        ),
      ];
    }

    return [item];
  });
}

export const TIME_OF_DAY_TITLE_RULES = `
TIME-OF-DAY TITLES (NEUROSYMBOLIC — NON-NEGOTIABLE):
- Titles must match the clock and the remaining day. Do not copy a full sunrise-to-bed arc if morning is already over.
- "Gentle awakening", wake-up, morning routine, rise-and-shine belong ONLY near wake time and NEVER after 10:30 or after now if morning has passed.
- Breakfast 06:00–10:30. Lunch 11:00–14:30. Dinner 17:00–20:30. Do not put breakfast or awakening in the afternoon.
- Wind-down / bedtime / lights-out only in the last ~90 minutes before bed. A midday "wind-down" is a break, not the end of the day.
- Whimsical names are fine only if the meaning still matches the hour (tea-party break at 3pm is ok; gentle awakening at 3pm is not).`;
