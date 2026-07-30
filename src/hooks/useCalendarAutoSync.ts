import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import {
  dispatchCalendarSynced,
  syncAllCalendarProviders,
} from "@/lib/calendarSync";
import { subscribeToEventKitChanges } from "@/lib/calendar";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const MIN_SYNC_GAP_MS = 2 * 60 * 1000;

type Options = {
  enabled: boolean;
  existingTasks: AnalyzedTask[];
  onTasksUpdated: (tasks: AnalyzedTask[]) => void;
  saveCalendarImport: (tasks: AnalyzedTask[]) => Promise<void>;
  /** Skip background sync while manual import/analysis is running. */
  paused?: boolean;
  /** Show a toast when new events are detected. */
  notifyOnNewEvents?: boolean;
};

export function useCalendarAutoSync({
  enabled,
  existingTasks,
  onTasksUpdated,
  saveCalendarImport,
  paused = false,
  notifyOnNewEvents = true,
}: Options) {
  const syncingRef = useRef(false);
  const lastSyncAtRef = useRef(0);
  const tasksRef = useRef(existingTasks);

  useEffect(() => {
    tasksRef.current = existingTasks;
  }, [existingTasks]);

  const runSync = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled || paused || syncingRef.current) return;
      if (!opts?.force && Date.now() - lastSyncAtRef.current < MIN_SYNC_GAP_MS) return;

      syncingRef.current = true;
      try {
        const result = await syncAllCalendarProviders({
          existingTasks: tasksRef.current,
          forceRefresh: true,
        });

        lastSyncAtRef.current = Date.now();

        if (result.needsAuth || result.error) return;

        const changed =
          result.newCount > 0 ||
          result.removedCount > 0 ||
          result.tasks.length !== tasksRef.current.length;

        if (!changed) return;

        tasksRef.current = result.tasks;
        onTasksUpdated(result.tasks);
        await saveCalendarImport(result.tasks);
        dispatchCalendarSynced(result.tasks, result.newCount);

        if (notifyOnNewEvents && result.newCount > 0) {
          toast.success(
            result.newCount === 1
              ? "1 new calendar event synced"
              : `${result.newCount} new calendar events synced`,
            { icon: "📅", duration: 4000 },
          );
        }
      } catch (err) {
        console.warn("[calendar-auto-sync]", err);
      } finally {
        syncingRef.current = false;
      }
    },
    [enabled, paused, notifyOnNewEvents, onTasksUpdated, saveCalendarImport],
  );

  useEffect(() => {
    if (!enabled || paused) return;

    const initialTimer = window.setTimeout(() => {
      void runSync({ force: true });
    }, 1500);

    const interval = window.setInterval(() => {
      void runSync();
    }, SYNC_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runSync();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    let offEventKit: (() => void) | undefined;
    void subscribeToEventKitChanges(() => {
      void runSync({ force: true });
    }).then((unsub) => {
      offEventKit = unsub ?? undefined;
    });

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      offEventKit?.();
    };
  }, [enabled, paused, runSync]);

  return { syncNow: () => runSync({ force: true }) };
}
