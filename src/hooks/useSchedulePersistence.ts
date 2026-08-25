import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScheduleItem, UserSettings } from "@/types/schedule";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import {
  appendLocalCalendarImportHistory,
  createCalendarImportEntry,
  type SavedCalendarImport,
} from "@/lib/calendarImportHistory";
import { localDateString } from "@/lib/localTime";

export interface VibeCheckEntry {
  at: string;
  mood: "great" | "okay" | "struggling";
  energy: "high" | "medium" | "low";
  needBreak: boolean;
  adjustSchedule: "keep" | "lighten" | "reschedule";
  notes: string;
  stressSignals?: {
    detected: boolean;
    matchedWords: string[];
    criticalOnly: boolean;
  };
}

export interface SessionExtras {
  journalText?: string;
  vibeCheck?: VibeCheckEntry;
}

const today = () => localDateString();
const LS_KEY = (date: string) => `timebunny:session:${date}`;
const SNAPSHOT_KEY = "timebunny:snapshot";
const SNAPSHOT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface ScheduleSnapshot {
  schedule: ScheduleItem[];
  settings: UserSettings | null;
  savedAt: number; // epoch ms
}

export const saveScheduleSnapshot = (schedule: ScheduleItem[], settings: UserSettings | null) => {
  try {
    const snap: ScheduleSnapshot = { schedule, settings, savedAt: Date.now() };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch (e) {
    console.error("Failed to save snapshot:", e);
  }
};

export const loadScheduleSnapshot = (): ScheduleSnapshot | null => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as ScheduleSnapshot;
    if (!snap?.savedAt || Date.now() - snap.savedAt > SNAPSHOT_TTL_MS) {
      localStorage.removeItem(SNAPSHOT_KEY);
      return null;
    }
    return snap;
  } catch {
    return null;
  }
};


interface LocalSession {
  schedule: ScheduleItem[];
  settings: UserSettings | null;
  journalText: string;
  vibeChecks: VibeCheckEntry[];
  calendarImport?: AnalyzedTask[];
}

const readLocal = (): LocalSession => {
  try {
    const raw = localStorage.getItem(LS_KEY(today()));
    if (!raw) return { schedule: [], settings: null, journalText: "", vibeChecks: [], calendarImport: [] };
    const parsed = JSON.parse(raw) as LocalSession;
    return { ...parsed, calendarImport: parsed.calendarImport ?? [] };
  } catch {
    return { schedule: [], settings: null, journalText: "", vibeChecks: [], calendarImport: [] };
  }
};

/** True when today's session already has imported calendar tasks (memory or local cache). */
export const hasSyncedCalendarToday = (tasks?: AnalyzedTask[]): boolean => {
  if (tasks && tasks.length > 0) return true;
  return (readLocal().calendarImport?.length ?? 0) > 0;
};

const writeLocal = (patch: Partial<LocalSession>) => {
  try {
    const cur = readLocal();
    const next = { ...cur, ...patch };
    localStorage.setItem(LS_KEY(today()), JSON.stringify(next));
  } catch (e) {
    console.error("Failed to persist locally:", e);
  }
};

export function useSchedulePersistence(userId: string | undefined) {
  const saveSchedule = useCallback(async (schedule: ScheduleItem[], settings: UserSettings) => {
    if (schedule.length === 0) return;
    writeLocal({ schedule, settings });
    if (!userId) return;
    const { error } = await supabase
      .from("user_schedules")
      .upsert(
        {
          user_id: userId,
          schedule_date: today(),
          schedule_data: schedule as any,
          settings: settings as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,schedule_date" }
      );
    if (error) console.error("Failed to save schedule:", error);
  }, [userId]);

  const saveJournal = useCallback(async (journalText: string) => {
    writeLocal({ journalText });
    if (!userId) return;
    const date = today();
    const local = readLocal();
    const { data } = await supabase
      .from("user_schedules")
      .select("schedule_data, settings, vibe_checks")
      .eq("user_id", userId)
      .eq("schedule_date", date)
      .maybeSingle();
    const remoteSchedule = (data?.schedule_data as unknown as ScheduleItem[] | null) ?? [];
    const schedule = local.schedule.length > 0 ? local.schedule : remoteSchedule;
    const { error } = await supabase
      .from("user_schedules")
      .upsert(
        {
          user_id: userId,
          schedule_date: date,
          schedule_data: schedule as any,
          settings: (data?.settings as any) ?? local.settings,
          journal_text: journalText,
          vibe_checks: (data?.vibe_checks as any) ?? local.vibeChecks,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,schedule_date" }
      );
    if (error) console.error("Failed to save journal:", error);
  }, [userId]);

  const appendVibeCheck = useCallback(async (entry: VibeCheckEntry) => {
    const cur = readLocal();
    writeLocal({ vibeChecks: [...cur.vibeChecks, entry] });
    if (!userId) return;
    const date = today();
    const { data } = await supabase
      .from("user_schedules")
      .select("schedule_data, settings, journal_text, vibe_checks")
      .eq("user_id", userId)
      .eq("schedule_date", date)
      .maybeSingle();
    const prev = (data?.vibe_checks as unknown as VibeCheckEntry[] | null) ?? [];
    const next = [...prev, entry];
    const remoteSchedule = (data?.schedule_data as unknown as ScheduleItem[] | null) ?? [];
    const schedule = cur.schedule.length > 0 ? cur.schedule : remoteSchedule;
    const { error } = await supabase
      .from("user_schedules")
      .upsert(
        {
          user_id: userId,
          schedule_date: date,
          schedule_data: schedule as any,
          settings: (data?.settings as any) ?? cur.settings,
          journal_text: (data?.journal_text as string | null) ?? cur.journalText,
          vibe_checks: next as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,schedule_date" }
      );
    if (error) console.error("Failed to save vibe check:", error);
  }, [userId]);

  const saveCalendarImport = useCallback(async (tasks: AnalyzedTask[]) => {
    if (tasks.length === 0) return;

    const entry = createCalendarImportEntry(tasks);
    appendLocalCalendarImportHistory(entry);
    writeLocal({ calendarImport: tasks });
    if (!userId) return;

    const date = today();
    const { data } = await supabase
      .from("user_schedules")
      .select("schedule_data, settings, journal_text, vibe_checks")
      .eq("user_id", userId)
      .eq("schedule_date", date)
      .maybeSingle();

    const existingSettings = (data?.settings as Record<string, unknown> | null) ?? {};
    const prevHistory = Array.isArray(existingSettings.calendarImportHistory)
      ? (existingSettings.calendarImportHistory as SavedCalendarImport[])
      : [];
    const calendarImportHistory = [entry, ...prevHistory.filter((h) => h.id !== entry.id)].slice(0, 100);

    const { error } = await supabase.from("user_schedules").upsert(
      {
        user_id: userId,
        schedule_date: date,
        schedule_data: ((Array.isArray(data?.schedule_data) && data.schedule_data.length > 0)
          ? data.schedule_data
          : readLocal().schedule) as any,
        settings: {
          ...existingSettings,
          calendarImport: {
            tasks,
            savedAt: entry.savedAt,
          },
          calendarImportHistory,
        } as any,
        journal_text: (data?.journal_text as string | null) ?? null,
        vibe_checks: (data?.vibe_checks as any) ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,schedule_date" },
    );
    if (error) console.error("Failed to save calendar import:", error);
  }, [userId]);

  const loadTodaySchedule = useCallback(async (): Promise<LocalSession | null> => {
    // Always check local first for instant restore
    const local = readLocal();
    if (!userId) {
      return local.schedule.length > 0 ||
        local.journalText ||
        local.vibeChecks.length > 0 ||
        (local.calendarImport?.length ?? 0) > 0
        ? local
        : null;
    }
    const { data, error } = await supabase
      .from("user_schedules")
      .select("schedule_data, settings, journal_text, vibe_checks")
      .eq("user_id", userId)
      .eq("schedule_date", today())
      .maybeSingle();
    if (error || !data) {
      return local.schedule.length > 0 ? local : null;
    }
    const remoteSchedule = (data.schedule_data as unknown as ScheduleItem[]) ?? [];
    const remote: LocalSession = {
      schedule: remoteSchedule.length > 0 ? remoteSchedule : local.schedule,
      settings: (data.settings as unknown as UserSettings | null) ?? local.settings,
      journalText: (data.journal_text as string | null) ?? local.journalText,
      vibeChecks: (data.vibe_checks as unknown as VibeCheckEntry[]) ?? local.vibeChecks,
      calendarImport:
        ((data.settings as Record<string, unknown> | null)?.calendarImport as { tasks?: AnalyzedTask[] } | undefined)
          ?.tasks ?? local.calendarImport ?? [],
    };
    writeLocal(remote);
    return remote;
  }, [userId]);

  return { saveSchedule, saveJournal, appendVibeCheck, saveCalendarImport, loadTodaySchedule };
}
