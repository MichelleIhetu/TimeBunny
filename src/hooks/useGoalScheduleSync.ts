import { useEffect, useRef } from "react";
import { ScheduleItem, UserSettings } from "@/types/schedule";
import { GoalWithProgress } from "@/hooks/useGoals";
import {
  countNewScheduleItems,
  fillGoalGapsInSchedule,
  formatGoalsForSchedule,
  schedulesEquivalent,
} from "@/lib/goalsSchedule";
import { toast } from "sonner";

/** Automatically finds gaps in the schedule and inserts goal blocks. */
export function useGoalScheduleSync(
  schedule: ScheduleItem[],
  goals: GoalWithProgress[],
  settings: UserSettings,
  setSchedule: (items: ScheduleItem[]) => void,
  enabled = true,
) {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled || syncingRef.current || schedule.length === 0 || goals.length === 0) return;

    const formatted = formatGoalsForSchedule(goals);
    const merged = fillGoalGapsInSchedule(schedule, formatted, settings);
    if (schedulesEquivalent(merged, schedule)) return;

    syncingRef.current = true;
    setSchedule(merged);

    const added = countNewScheduleItems(schedule, merged);
    if (added > 0) {
      toast.success(`Found ${added} open gap${added > 1 ? "s" : ""} for your goals 🎯`);
    }

    queueMicrotask(() => {
      syncingRef.current = false;
    });
  }, [schedule, goals, settings, setSchedule, enabled]);
}
