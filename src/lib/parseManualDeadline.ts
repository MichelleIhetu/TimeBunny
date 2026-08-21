import { addDaysToDateString, localDateString, localTimeString } from "@/lib/localTime";

export type ParsedDeadline = {
  date: string;
  startTime: string | null;
};

/** Best-effort parse for free-text wizard deadlines (e.g. "5pm", "tomorrow 3pm", "2026-08-17"). */
export function parseManualDeadline(raw: string, now = new Date()): ParsedDeadline | null {
  const text = raw.trim();
  if (!text) return null;

  const today = localDateString(now);

  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (isoDate) return { date: isoDate[1], startTime: null };

  const isoDateTime = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2})/);
  if (isoDateTime) {
    return {
      date: isoDateTime[1],
      startTime: `${isoDateTime[2].padStart(2, "0")}:${isoDateTime[3]}`,
    };
  }

  const lower = text.toLowerCase();
  let date = today;
  if (lower.includes("tomorrow")) {
    date = addDaysToDateString(today, 1);
  } else if (!lower.includes("today") && !/\d/.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return { date: localDateString(parsed), startTime: localTimeString(parsed) };
    }
    return null;
  }

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return {
      date,
      startTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }

  const embedded = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (embedded) return { date: embedded[1], startTime: null };

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return { date: localDateString(parsed), startTime: localTimeString(parsed) };
  }

  if (lower.includes("today") || lower.includes("tomorrow")) {
    return { date, startTime: null };
  }

  return null;
}
