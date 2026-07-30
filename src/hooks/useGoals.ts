import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { localDateString } from "@/lib/localTime";

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal_type: "monthly" | "ongoing";
  target_hours: number;
  target_unit: string;
  category: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalLog {
  id: string;
  goal_id: string;
  user_id: string;
  log_date: string;
  hours_logged: number;
  notes: string | null;
  created_at: string;
}

export interface GoalWithProgress extends Goal {
  totalLogged: number;
  streak: number;
  logs: GoalLog[];
}

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
    } else if (i === 0 && logDate.getTime() === new Date(today.getTime() - 86400000).getTime()) {
      // Allow yesterday as start of streak
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function useGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: goalsData, error: goalsErr } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (goalsErr) {
      console.error("Failed to fetch goals:", goalsErr);
      setLoading(false);
      return;
    }

    const { data: logsData, error: logsErr } = await supabase
      .from("goal_logs")
      .select("*")
      .eq("user_id", user.id);

    if (logsErr) {
      console.error("Failed to fetch logs:", logsErr);
    }

    const allLogs = (logsData || []) as GoalLog[];

    const enriched: GoalWithProgress[] = (goalsData || []).map((g: any) => {
      const goalLogs = allLogs.filter((l) => l.goal_id === g.id);
      const totalLogged = goalLogs.reduce((sum, l) => sum + Number(l.hours_logged), 0);
      const streak = calculateStreak(goalLogs);
      return { ...g, totalLogged, streak, logs: goalLogs };
    });

    setGoals(enriched);
    try {
      localStorage.setItem(`timebunny_goals_${user.id}`, JSON.stringify(enriched));
    } catch {
      // ignore quota / private mode
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const addGoal = async (goal: {
    title: string;
    description?: string;
    goal_type: "monthly" | "ongoing";
    target_hours: number;
    target_unit?: string;
    category: string;
    end_date?: string;
  }) => {
    if (!user) {
      toast.error("Please sign in to save goals");
      return;
    }
    const unit = goal.target_unit || "hours";
    const bookCompletion = isBookCompletionUnit(unit);
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      title: goal.title,
      description: goal.description || null,
      goal_type: bookCompletion ? "ongoing" : goal.goal_type,
      target_hours: goal.target_hours,
      target_unit: unit,
      category: goal.category,
      end_date: bookCompletion ? null : goal.end_date || null,
    });
    if (error) {
      console.error("Failed to create goal:", error);
      toast.error(`Failed to create goal: ${error.message}`);
      return;
    }
    toast.success("Goal created! Start building that habit 🔥");
    fetchGoals();
  };

  const addGoalProgress = async (goalId: string, deltaHours: number, notes?: string, silent = false) => {
    if (!user || deltaHours <= 0) return;
    const today = localDateString();

    const { data: existing } = await supabase
      .from("goal_logs")
      .select("hours_logged, notes")
      .eq("goal_id", goalId)
      .eq("log_date", today)
      .maybeSingle();

    const priorHours = existing?.hours_logged ? Number(existing.hours_logged) : 0;
    const newHours = priorHours + deltaHours;

    const { error } = await supabase.from("goal_logs").upsert(
      {
        goal_id: goalId,
        user_id: user.id,
        log_date: today,
        hours_logged: newHours,
        notes: notes || existing?.notes || null,
      },
      { onConflict: "goal_id,log_date" },
    );

    if (error) {
      if (!silent) toast.error("Failed to log goal progress");
      return;
    }
    if (!silent) {
      const goal = goals.find((g) => g.id === goalId);
      const unit = normalizeGoalUnit(goal?.target_unit);
      if (unit === "pages") toast.success(`+${Math.round(deltaHours)} pages logged toward your book 📖`);
      else if (unit === "chapters") toast.success(`+${Math.round(deltaHours)} chapters logged toward your book 📖`);
      else toast.success(`+${Math.round(deltaHours * 60)} min logged toward your goal 🎯`);
    }
    fetchGoals();
  };

  const logProgress = async (goalId: string, amount: number, notes?: string) => {
    if (!user || amount <= 0) return;

    const goal = goals.find((g) => g.id === goalId);
    const unit = normalizeGoalUnit(goal?.target_unit);

    if (isBookCompletionUnit(unit)) {
      await addGoalProgress(goalId, amount, notes);
      return;
    }

    const today = localDateString();

    const { error } = await supabase.from("goal_logs").upsert(
      {
        goal_id: goalId,
        user_id: user.id,
        log_date: today,
        hours_logged: amount,
        notes: notes || null,
      },
      { onConflict: "goal_id,log_date" },
    );

    if (error) {
      toast.error("Failed to log progress");
      return;
    }
    toast.success("Progress logged! Keep stacking those wins 💪");
    fetchGoals();
  };

  const archiveGoal = async (goalId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("goals")
      .update({ is_active: false })
      .eq("id", goalId)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Failed to archive goal");
      return;
    }
    toast.success("Goal archived");
    fetchGoals();
  };

  return { goals, loading, addGoal, logProgress, addGoalProgress, archiveGoal, refetch: fetchGoals };
}
