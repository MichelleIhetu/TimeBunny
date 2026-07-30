import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import { localDateString } from "@/lib/localTime";

export interface SavedCalendarImport {
  id: string;
  savedAt: string;
  scheduleDate: string;
  tasks: AnalyzedTask[];
}

const HISTORY_KEY = "timebunny:calendar-import-history";
const MAX_HISTORY = 100;

export const createCalendarImportEntry = (tasks: AnalyzedTask[]): SavedCalendarImport => ({
  id: crypto.randomUUID(),
  savedAt: new Date().toISOString(),
  scheduleDate: localDateString(),
  tasks,
});

export const loadLocalCalendarImportHistory = (): SavedCalendarImport[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCalendarImport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const appendLocalCalendarImportHistory = (entry: SavedCalendarImport) => {
  const prev = loadLocalCalendarImportHistory().filter((e) => e.id !== entry.id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...prev].slice(0, MAX_HISTORY)));
};

export const extractImportsFromSettings = (
  settings: unknown,
  scheduleDate: string,
): SavedCalendarImport[] => {
  if (!settings || typeof settings !== "object") return [];
  const s = settings as Record<string, unknown>;
  const out: SavedCalendarImport[] = [];

  const history = s.calendarImportHistory;
  if (Array.isArray(history)) {
    for (const item of history) {
      if (item && typeof item === "object" && Array.isArray((item as SavedCalendarImport).tasks)) {
        out.push(item as SavedCalendarImport);
      }
    }
  }

  const latest = s.calendarImport as { tasks?: AnalyzedTask[]; savedAt?: string } | undefined;
  if (latest?.tasks?.length) {
    out.push({
      id: `legacy-${scheduleDate}-${latest.savedAt ?? "unknown"}`,
      savedAt: latest.savedAt ?? new Date().toISOString(),
      scheduleDate,
      tasks: latest.tasks,
    });
  }

  return out;
};

export const mergeCalendarImportHistory = (...lists: SavedCalendarImport[][]): SavedCalendarImport[] => {
  const byId = new Map<string, SavedCalendarImport>();
  for (const list of lists) {
    for (const entry of list) {
      if (!entry?.tasks?.length) continue;
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
};
