import { useCallback, useEffect, useRef } from "react";

import { toast } from "sonner";

import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";

import {

  dispatchCalendarSynced,

  syncAllCalendarProviders,

} from "@/lib/calendarSync";

import {

  BACKGROUND_SYNC_INITIAL_DELAY_MS,

  BACKGROUND_SYNC_INTERVAL_MS,

  BACKGROUND_SYNC_MIN_GAP_MS,

  dispatchCalendarBackgroundSyncStatus,

} from "@/lib/calendarBackgroundSync";

import { isCalendarSyncPaused } from "@/lib/calendarSyncPause";

import { subscribeToEventKitChanges } from "@/lib/calendar";

import { notifyUrgentNewTasks } from "@/lib/urgentScheduleItems";



type Options = {

  enabled: boolean;

  existingTasks: AnalyzedTask[];

  onTasksUpdated: (tasks: AnalyzedTask[]) => void;

  saveCalendarImport: (tasks: AnalyzedTask[]) => Promise<void>;

  /** Skip background sync while manual import/analysis is running. */

  paused?: boolean;

  /** Show a toast when new events are detected (off for silent background sync). */

  notifyOnNewEvents?: boolean;

};



/**

 * Keeps calendar data fresh while the app is open. Pulls Google/EventKit on a

 * timer, on tab focus, and when triggered — users never need to re-sync manually.

 */

export function useCalendarAutoSync({

  enabled,

  existingTasks,

  onTasksUpdated,

  saveCalendarImport,

  paused = false,

  notifyOnNewEvents = false,

}: Options) {

  const syncingRef = useRef(false);

  const lastSyncAtRef = useRef(0);

  const tasksRef = useRef(existingTasks);

  const authWarnedRef = useRef(false);



  useEffect(() => {

    tasksRef.current = existingTasks;

  }, [existingTasks]);



  const runSync = useCallback(

    async (opts?: { force?: boolean }) => {

      if (!enabled || paused || isCalendarSyncPaused() || syncingRef.current) return;

      if (!opts?.force && Date.now() - lastSyncAtRef.current < BACKGROUND_SYNC_MIN_GAP_MS) return;



      syncingRef.current = true;

      dispatchCalendarBackgroundSyncStatus({ running: true });



      try {

        const result = await syncAllCalendarProviders({

          existingTasks: tasksRef.current,

          forceRefresh: true,

        });



        lastSyncAtRef.current = Date.now();

        dispatchCalendarBackgroundSyncStatus({

          lastSyncAt: lastSyncAtRef.current,

          lastNewCount: result.newCount,

          running: false,

        });



        if (result.needsAuth && result.newCount === 0 && result.tasks.length === tasksRef.current.length) {

          if (!authWarnedRef.current) {

            authWarnedRef.current = true;

            toast("Calendar sync paused — reconnect Google Calendar when you can.", {

              icon: "📅",

              duration: 5000,

            });

          }

          return;

        }



        authWarnedRef.current = false;



        const changed =

          result.newCount > 0 ||

          result.removedCount > 0 ||

          result.tasks.length !== tasksRef.current.length;



        if (!changed) return;



        const beforeTasks = tasksRef.current;

        tasksRef.current = result.tasks;

        onTasksUpdated(result.tasks);

        await saveCalendarImport(result.tasks);

        dispatchCalendarSynced(result.tasks, result.newCount);



        const urgentNew = notifyUrgentNewTasks(

          beforeTasks,

          result.tasks,

          "calendar",

          result.newEvents ?? [],

        );



        if (notifyOnNewEvents && result.newCount > 0 && urgentNew.length === 0) {

          toast.success(

            result.newCount === 1

              ? "1 new calendar event synced"

              : `${result.newCount} new calendar events synced`,

            { icon: "📅", duration: 4000 },

          );

        }

      } catch (err) {

        console.warn("[calendar-auto-sync]", err);

        dispatchCalendarBackgroundSyncStatus({ running: false });

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

    }, BACKGROUND_SYNC_INITIAL_DELAY_MS);



    const interval = window.setInterval(() => {

      void runSync();

    }, BACKGROUND_SYNC_INTERVAL_MS);



    const onVisibility = () => {

      if (document.visibilityState === "visible") {

        void runSync({ force: true });

      }

    };



    const onOnline = () => {

      void runSync({ force: true });

    };



    document.addEventListener("visibilitychange", onVisibility);

    window.addEventListener("online", onOnline);



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

      window.removeEventListener("online", onOnline);

      offEventKit?.();

    };

  }, [enabled, paused, runSync]);



  return { syncNow: () => runSync({ force: true }) };

}


