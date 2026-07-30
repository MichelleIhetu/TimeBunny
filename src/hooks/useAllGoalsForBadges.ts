import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { GoalLog, GoalWithProgress } from "@/hooks/useGoals";

function calculateStreak(logs: GoalLog[]): number {
  if (logs.length === 0) return 0;
  const sorted = [...logs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const logDate = new Date(sorted[i].log_date);
    logDate.setHours(0, 0, 0, 0);
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (logDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else if (i === 0 && logDate.getTime() === today.getTime() - 86400000) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** All goals (including archived) — used for badge unlocks. */
export function useAllGoalsForBadges() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: goalsData, error: goalsErr } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (goalsErr) {
      console.error("Failed to fetch goals for badges:", goalsErr);
      setLoading(false);
      return;
    }

    const { data: logsData } = await supabase.from("goal_logs").select("*").eq("user_id", user.id);
    const allLogs = (logsData || []) as GoalLog[];

    const enriched: GoalWithProgress[] = (goalsData || []).map((g) => {
      const goalLogs = allLogs.filter((l) => l.goal_id === g.id);
      const totalLogged = goalLogs.reduce((sum, l) => sum + Number(l.hours_logged), 0);
      return { ...g, totalLogged, streak: calculateStreak(goalLogs), logs: goalLogs };
    });

    setGoals(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { goals, loading, refetch: fetchAll };
}
