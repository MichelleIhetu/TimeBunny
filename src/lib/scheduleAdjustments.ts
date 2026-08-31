import { DEFAULT_SCHEDULE_SUIT, type ScheduleItem } from "@/types/schedule";
import { isEndOfDayBlock, isFixedCalendarBlock, isRelaxationBlock } from "@/lib/goalsSchedule";
import { alignScheduleToTimeOfDay, type TimeOfDayContext } from "@/lib/scheduleTimeOfDay";

const parseHHMM = (time: string | undefined): number | null => {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const formatHHMM = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(Math.round(minutes), 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const titleKey = (item: ScheduleItem): string =>
  item.title.replace(/^🎯\s*/, "").replace(/^Deferred —\s*/i, "").trim().toLowerCase();

const itemKey = (item: ScheduleItem): string => `${item.time}|${titleKey(item)}`;

const overlaps = (startA: number, endA: number, startB: number, endB: number): boolean =>
  startA < endB && startB < endA;

/** Insert a recharge break at the current time without dropping existing tasks. */
export const insertBreakIntoSchedule = (
  schedule: ScheduleItem[],
  nowHHMM: string,
  durationMinutes = 15,
): ScheduleItem[] => {
  const now = parseHHMM(nowHHMM);
  if (now === null) return schedule;

  const breakEnd = Math.min(now + durationMinutes, 23 * 60 + 59);

  const hasNearbyBreak = schedule.some((item) => {
    if (!isRelaxationBlock(item.title)) return false;
    const start = parseHHMM(item.time);
    if (start === null) return false;
    const end = parseHHMM(item.endTime) ?? start + durationMinutes;
    return overlaps(start, end, now, breakEnd) || Math.abs(start - now) <= 10;
  });
  if (hasNearbyBreak) {
    return [...schedule].sort((a, b) => a.time.localeCompare(b.time));
  }

  const breakItem: ScheduleItem = {
    id: `break-now-${Date.now()}`,
    title: "Break ☕",
    time: formatHHMM(now),
    endTime: formatHHMM(breakEnd),
    description: "Recharge break — your other tasks are still on the schedule.",
    suit: DEFAULT_SCHEDULE_SUIT,
  };

  const shifted = schedule.map((item) => {
    const start = parseHHMM(item.time);
    if (start === null) return item;

    if (start < now) {
      const end = parseHHMM(item.endTime);
      if (end !== null && end > now) {
        return { ...item, endTime: formatHHMM(now) };
      }
      return item;
    }

    if (start < breakEnd) {
      const end = parseHHMM(item.endTime);
      const duration = end !== null && end > start ? end - start : null;
      const newStart = breakEnd;
      return {
        ...item,
        time: formatHHMM(newStart),
        endTime: duration !== null ? formatHHMM(newStart + duration) : item.endTime,
      };
    }

    return item;
  });

  return [...shifted, breakItem].sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * Apply an AI/updated schedule without losing history.
 * Items that already started stay as they were. Future items come from `incoming`.
 * When keepDroppedFuture is true, original future tasks the update omitted are
 * kept later in the day so they remain findable.
 */
export const mergeScheduleUpdate = (
  original: ScheduleItem[],
  incoming: ScheduleItem[],
  nowHHMM: string,
  options?: { keepDroppedFuture?: boolean; bedTime?: string; wakeTime?: string },
): ScheduleItem[] => {
  const now = parseHHMM(nowHHMM);
  if (now === null) {
    const byKey = new Map<string, ScheduleItem>();
    for (const item of original) byKey.set(itemKey(item), item);
    for (const item of incoming) byKey.set(itemKey(item), item);
    return [...byKey.values()].sort((a, b) => a.time.localeCompare(b.time));
  }

  if (incoming.length === 0) return original;

  const past = original.filter((item) => {
    const t = parseHHMM(item.time);
    return t !== null && t < now;
  });
  const pastKeys = new Set(past.map(itemKey));
  const pastTitles = new Set(past.map(titleKey));

  const future = incoming.filter((item) => {
    const t = parseHHMM(item.time);
    if (t !== null && t < now) return false;
    return !pastKeys.has(itemKey(item));
  });

  const incomingTitles = new Set(future.map(titleKey));
  let extras: ScheduleItem[] = [];

  if (options?.keepDroppedFuture) {
    const originalFuture = original.filter((item) => {
      const t = parseHHMM(item.time);
      return t !== null && t >= now && !incomingTitles.has(titleKey(item)) && !pastTitles.has(titleKey(item));
    });

    if (originalFuture.length > 0) {
      const bed = parseHHMM(options?.bedTime);
      const eodStart = future
        .filter((item) => isEndOfDayBlock(item.title, item.description))
        .map((item) => parseHHMM(item.time))
        .filter((t): t is number => t !== null)
        .sort((a, b) => a - b)[0];
      const workDeadline =
        eodStart !== undefined && bed !== null
          ? Math.min(eodStart, bed)
          : eodStart ?? bed ?? null;

      const lastWork = [...future]
        .filter((item) => !isEndOfDayBlock(item.title, item.description))
        .sort((a, b) => a.time.localeCompare(b.time))
        .at(-1);
      const lastWorkEnd =
        (lastWork && (parseHHMM(lastWork.endTime) ?? (parseHHMM(lastWork.time) ?? now) + 30)) ||
        now + 15;

      let cursor = Math.max(lastWorkEnd, now + 15);
      if (workDeadline !== null && cursor >= workDeadline) {
        cursor = Math.max(now, workDeadline - originalFuture.length * 30);
      }

      extras = originalFuture.map((item, index) => {
        const origStart = parseHHMM(item.time);
        const origEnd = parseHHMM(item.endTime);
        const duration =
          origStart !== null && origEnd !== null && origEnd > origStart ? origEnd - origStart : 30;
        let start = cursor + index * Math.max(duration, 20);
        if (workDeadline !== null && start + duration > workDeadline) {
          start = Math.max(now, workDeadline - duration);
        }
        return {
          ...item,
          id: `${item.id}-kept`,
          time: formatHHMM(start),
          endTime: formatHHMM(start + duration),
          description: [item.description, "Kept from your original schedule (moved later)."]
            .filter(Boolean)
            .join(" — "),
        };
      });
    }
  }

  return enforceEveningContext([...past, ...future, ...extras], {
    bedTime: options?.bedTime,
    wakeTime: options?.wakeTime,
    nowHHMM,
  });
};

const itemDurationMinutes = (item: ScheduleItem): number => {
  const start = parseHHMM(item.time);
  const end = parseHHMM(item.endTime);
  if (start !== null && end !== null && end > start) return Math.max(15, end - start);
  return 30;
};

/**
 * Keep the day in a sensible order: work and homework before wind-down / bedtime.
 * Never leave a focus task after the user has already retired for the night.
 * Titles are aligned to time of day first (no midday "gentle awakening").
 */
export const enforceEveningContext = (
  schedule: ScheduleItem[],
  bedTimeOrOptions?: string | TimeOfDayContext,
): ScheduleItem[] => {
  const ctx: TimeOfDayContext =
    typeof bedTimeOrOptions === "object" && bedTimeOrOptions !== null
      ? bedTimeOrOptions
      : { bedTime: bedTimeOrOptions };
  const aligned = alignScheduleToTimeOfDay(schedule, ctx);
  if (aligned.length === 0) return aligned;

  const bed = parseHHMM(ctx.bedTime);
  const sorted = [...aligned].sort((a, b) => a.time.localeCompare(b.time));
  const eodStarts = sorted
    .filter((item) => isEndOfDayBlock(item.title, item.description))
    .map((item) => parseHHMM(item.time))
    .filter((t): t is number => t !== null);
  const firstEod = eodStarts.length > 0 ? Math.min(...eodStarts) : null;
  const cutoff =
    firstEod !== null && bed !== null ? Math.min(firstEod, bed) : firstEod ?? bed;
  if (cutoff === null) return sorted;

  const daytime: ScheduleItem[] = [];
  const misplaced: ScheduleItem[] = [];
  const eod: ScheduleItem[] = [];
  const lateFixed: ScheduleItem[] = [];

  for (const item of sorted) {
    const start = parseHHMM(item.time);
    if (isEndOfDayBlock(item.title, item.description)) {
      eod.push(item);
      continue;
    }
    if (start !== null && start >= cutoff && isFixedCalendarBlock(item)) {
      lateFixed.push(item);
      continue;
    }
    if (start !== null && start >= cutoff) {
      misplaced.push(item);
      continue;
    }
    daytime.push(item);
  }

  if (misplaced.length === 0) return sorted;

  const lastDaytimeEnd = daytime.reduce((max, item) => {
    const end = parseHHMM(item.endTime) ?? parseHHMM(item.time);
    return end !== null ? Math.max(max, end) : max;
  }, 0);

  const misplacedDur = misplaced.reduce((sum, item) => sum + itemDurationMinutes(item), 0);
  const eodDur = eod.reduce((sum, item) => sum + itemDurationMinutes(item), 0);
  const eveningLimit = bed ?? cutoff + eodDur;
  const workEndLimit = Math.max(cutoff, eveningLimit - Math.min(eodDur, 25));
  const packedEnd = Math.min(cutoff, workEndLimit);

  // Park leftover work so it *ends* at wind-down/bedtime — never at midnight
  // just because nothing else was on the afternoon calendar.
  let cursor = Math.max(0, packedEnd - misplacedDur);
  if (daytime.length > 0 && lastDaytimeEnd > 0 && lastDaytimeEnd + misplacedDur <= packedEnd) {
    cursor = lastDaytimeEnd;
  }

  const placedMisplaced = misplaced.map((item) => {
    const duration = itemDurationMinutes(item);
    const start = cursor;
    cursor += duration;
    return {
      ...item,
      time: formatHHMM(start),
      endTime: formatHHMM(start + duration),
    };
  });

  const placedEod = eod.map((item) => {
    const duration = itemDurationMinutes(item);
    const start = Math.max(cursor, cutoff);
    let end = start + duration;
    if (bed !== null && end > bed) end = Math.max(start + 15, bed);
    cursor = end;
    return {
      ...item,
      time: formatHHMM(start),
      endTime: formatHHMM(end),
    };
  });

  return [...daytime, ...placedMisplaced, ...placedEod, ...lateFixed].sort((a, b) =>
    a.time.localeCompare(b.time),
  );
};
