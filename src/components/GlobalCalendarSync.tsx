import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import { CALENDAR_SYNCED_EVENT, CALENDAR_SYNC_NOW_EVENT } from "@/lib/calendarSync";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarAutoSync } from "@/hooks/useCalendarAutoSync";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { supabase } from "@/integrations/supabase/client";

/**
 * App-wide 24-hour lookahead calendar sync. Runs on every page while signed in
 * so new/updated Google Calendar events appear without manual re-sync.
 */
export default function GlobalCalendarSync() {
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { saveCalendarImport, loadTodaySchedule } = useSchedulePersistence(user?.id);
  const [tasks, setTasks] = useState<AnalyzedTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const lastRouteSyncRef = useRef("");

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    loadTodaySchedule().then((session) => {
      if (cancelled) return;
      setTasks(session?.calendarImport ?? []);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user, loadTodaySchedule]);

  const { syncNow } = useCalendarAutoSync({
    enabled: !!user && !authLoading && loaded,
    existingTasks: tasks,
    onTasksUpdated: setTasks,
    saveCalendarImport,
    notifyOnNewEvents: false,
  });

  useEffect(() => {
    const onSyncNow = () => {
      void syncNow();
    };
    window.addEventListener(CALENDAR_SYNC_NOW_EVENT, onSyncNow);
    return () => window.removeEventListener(CALENDAR_SYNC_NOW_EVENT, onSyncNow);
  }, [syncNow]);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ tasks?: AnalyzedTask[] }>).detail;
      if (detail?.tasks) setTasks(detail.tasks);
    };
    window.addEventListener(CALENDAR_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(CALENDAR_SYNCED_EVENT, onSynced);
  }, []);

  useEffect(() => {
    if (!user || authLoading || !loaded) return;
    if (lastRouteSyncRef.current === pathname) return;
    lastRouteSyncRef.current = pathname;
    void syncNow();
  }, [pathname, user, authLoading, loaded, syncNow]);

  useEffect(() => {
    if (!user) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void syncNow();
      }
    });

    return () => subscription.unsubscribe();
  }, [user, syncNow]);

  return null;
}
