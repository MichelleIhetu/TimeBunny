import type { CSSProperties } from "react";
import type { CalendarEvent } from "@/components/CalendarImportModal";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { ScheduleItem } from "@/types/schedule";

export type JournalTaskRef = {
  id: string;
  title: string;
  deadline?: string;
};

export type JournalReferenceType = "Calendar" | "Event" | "Task" | "Schedule";

export type JournalReferenceInsert = {
  type: JournalReferenceType;
  display: string;
};

export const JOURNAL_REF_MARKER = /⟦([^|]+)\|([^⟧]+)⟧/g;

export const JOURNAL_REF_PIXEL_STYLE: CSSProperties = {
  fontFamily: "'Press Start 2P', cursive",
  fontWeight: 700,
  color: "#22c55e",
  fontSize: "0.62rem",
  lineHeight: "1.85rem",
  verticalAlign: "baseline",
};

export function encodeJournalReference(type: JournalReferenceType, display: string): string {
  return `⟦${type}|${display}⟧`;
}

export function calendarEventReference(event: CalendarEvent): JournalReferenceInsert {
  const time = event.isAllDay ? "All day" : `${event.startTime}–${event.endTime}`;
  return { type: "Calendar", display: `${event.title} (${time})` };
}

export function analyzedTaskReference(task: AnalyzedTask): JournalReferenceInsert {
  const when = [task.date, task.startTime].filter(Boolean).join(" · ");
  const suffix = when ? ` · ${when}` : "";
  return { type: "Event", display: `${task.title}${suffix}` };
}

export function scheduleItemReference(item: ScheduleItem): JournalReferenceInsert {
  const time = item.time ? ` @ ${item.time}` : "";
  return { type: "Schedule", display: `${item.title}${time}` };
}

export function taskReference(task: JournalTaskRef): JournalReferenceInsert {
  let display = task.title;
  if (task.deadline?.trim()) display += ` · Due ${task.deadline.trim()}`;
  return { type: "Task", display };
}

export type JournalContentPart =
  | { kind: "text"; value: string }
  | { kind: "ref"; type: JournalReferenceType; display: string };

export function parseJournalContent(text: string): JournalContentPart[] {
  if (!text) return [];

  const parts: JournalContentPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(JOURNAL_REF_MARKER)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, index) });
    }
    parts.push({
      kind: "ref",
      type: match[1] as JournalReferenceType,
      display: match[2],
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

/** Plain text for AI prompts and search — references stay readable. */
export function journalContentToPlainText(text: string): string {
  return parseJournalContent(text)
    .map((part) => (part.kind === "text" ? part.value : `[${part.type}: ${part.display}]`))
    .join("");
}

export function insertJournalReferenceMarker(
  current: string,
  ref: JournalReferenceInsert,
  selectionStart: number,
  selectionEnd: number,
): { text: string; cursor: number } {
  const marker = encodeJournalReference(ref.type, ref.display);
  const prefix = current.slice(0, selectionStart);
  const suffix = current.slice(selectionEnd);
  const needsGap = prefix.length > 0 && !/\s$/.test(prefix);
  const snippet = `${needsGap ? " " : ""}${marker} `;
  const text = prefix + snippet + suffix;
  const cursor = prefix.length + snippet.length;
  return { text, cursor };
}

/** @deprecated Use calendarEventReference — kept for any stale imports */
export function formatCalendarEventReference(event: CalendarEvent): string {
  const ref = calendarEventReference(event);
  return encodeJournalReference(ref.type, ref.display);
}

export function formatAnalyzedTaskReference(task: AnalyzedTask): string {
  const ref = analyzedTaskReference(task);
  return encodeJournalReference(ref.type, ref.display);
}

export function formatScheduleItemReference(item: ScheduleItem): string {
  const ref = scheduleItemReference(item);
  return encodeJournalReference(ref.type, ref.display);
}

export function formatTaskReference(task: JournalTaskRef): string {
  const ref = taskReference(task);
  return encodeJournalReference(ref.type, ref.display);
}

export function insertJournalReference(
  current: string,
  referenceLine: string,
  selectionStart: number,
  selectionEnd: number,
): { text: string; cursor: number } {
  const prefix = current.slice(0, selectionStart);
  const suffix = current.slice(selectionEnd);
  const needsGap = prefix.length > 0 && !prefix.endsWith("\n");
  const snippet = `${needsGap ? "\n" : ""}${referenceLine}\n`;
  const text = prefix + snippet + suffix;
  const cursor = prefix.length + snippet.length;
  return { text, cursor };
}
