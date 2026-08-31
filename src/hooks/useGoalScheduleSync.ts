import { useEffect, useRef } from "react";
import { ScheduleItem, UserSettings } from "@/types/schedule";
import { GoalWithProgress } from "@/hooks/useGoals";
import {
  countNewScheduleItems,
  fillGoalGapsInSchedule,
  formatGoalsForSchedule,
  removeCompletedGoalBlocks,
  schedulesEquivalent,
} from "@/lib/goalsSchedule";
import { enforceEveningContext } from "@/lib/scheduleAdjustments";
import { dropUnrequestedPastDueItems, filterGoalsForSchedule } from "@/lib/schedulePastDue";
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

    const allGoals = formatGoalsForSchedule(goals);
    const formatted = filterGoalsForSchedule(allGoals);
    const cleaned = dropUnrequestedPastDueItems(removeCompletedGoalBlocks(schedule, goals), {
      goals: allGoals,
    });
    let merged: ScheduleItem[];
    try {
      merged = enforceEveningContext(
        fillGoalGapsInSchedule(cleaned, formatted, settings),
        {
          bedTime: settings.bedTime,
          wakeTime: settings.wakeTime,
        },
      );
    } catch (err) {
      console.error("Goal schedule sync failed:", err);
      return;
    }
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
