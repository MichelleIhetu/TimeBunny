import { useState, useEffect, useRef } from "react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Flame, Target, TrendingUp, Archive, Clock, Wand2, CheckCircle2, X, Route, CalendarPlus, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoals, GoalWithProgress } from "@/hooks/useGoals";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  GoalSuggestion,
  goalSuggestionsToScheduleItems,
  mergeScheduleItems,
} from "@/lib/goalsSchedule";
import {
  defaultTargetForUnit,
  formatGoalProgress,
  GoalTargetUnit,
  goalProgressSubtitle,
  isBookCompletionUnit,
  isReadingCategory,
  logPlaceholder,
  logStep,
  normalizeGoalUnit,
  progressPercent,
  READING_TARGET_UNITS,
  targetLabel,
} from "@/lib/goalUnits";
import {
  isGoalComplete,
  loadCelebratedGoalIds,
  saveCelebratedGoalIds,
} from "@/lib/goalCarrots";
import { endOfMonthDateString, localMonthString } from "@/lib/localTime";
import { UserSettings } from "@/types/schedule";
import GoalCarrotCelebration from "@/components/GoalCarrotCelebration";

const defaultScheduleSettings: UserSettings = {
  energyLevel: "motivated",
  stressLevel: "medium",
  wakeTime: "07:00",
  bedTime: "23:00",
};

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

const CATEGORIES = [
  { value: "fitness", label: "🏋️ Fitness", tip: "Start with just 2 mins — make it obvious & easy" },
  { value: "learning", label: "📚 Learning", tip: "Attach it to an existing habit (habit stacking)" },
  { value: "reading", label: "📖 Reading", tip: "Log pages or chapters toward finishing the book" },
  { value: "creative", label: "🎨 Creative Projects", tip: "Never miss twice — get back on track fast" },
  { value: "career", label: "💼 Career Growth", tip: "Track it visibly — don't break the chain" },
  { value: "wellness", label: "🧘 Wellness", tip: "Environment > motivation — design your space" },
  { value: "general", label: "⭐ General", tip: "Make it satisfying — reward yourself after" },
];

function getAtomicTip(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.tip || "Small steps compound into remarkable results";
}

function GoalCard({
  goal,
  onLog,
  onArchive,
}: {
  goal: GoalWithProgress;
  onLog: (id: string, amount: number, notes?: string) => void;
  onArchive: (id: string) => void;
}) {
  const unit = normalizeGoalUnit(goal.target_unit);
  const [logAmount, setLogAmount] = useState(() => (unit === "hours" ? "0.5" : unit === "minutes" ? "30" : "10"));
  const [logNotes, setLogNotes] = useState("");
  const [showLog, setShowLog] = useState(false);

  const progress = progressPercent(goal.totalLogged, goal.target_hours);
  const categoryInfo = CATEGORIES.find((c) => c.value === goal.category);
  const emoji = categoryInfo?.label.split(" ")[0] ?? "⭐";

  const handleLog = () => {
    onLog(goal.id, parseFloat(logAmount) || 0, logNotes || undefined);
    setLogAmount(unit === "hours" ? "0.5" : unit === "minutes" ? "30" : "10");
    setLogNotes("");
    setShowLog(false);
  };

  const complete = progress >= 100;

  return (
    <div className={`group relative bg-white border-2 p-4 hover:bg-purple-50 transition-colors ${complete ? "border-[#2dd4bf]" : "border-[#ddd6fe]"}`}>
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[#5b21b6] text-[11px] mb-2 leading-relaxed flex items-center gap-2" style={PIXEL}>
            <span className="text-base leading-none">{emoji}</span>
            <span className="truncate">{goal.title}</span>
            {complete && (
              <span className="text-[9px] text-[#2dd4bf] flex-shrink-0" style={PIXEL}>
                ✓ DONE
              </span>
            )}
          </h3>
          <p className="text-[#a78bfa] text-lg leading-none" style={VT}>
            {formatGoalProgress(goal.totalLogged, goal.target_hours, unit)} · {goalProgressSubtitle(unit, goal.goal_type)}
          </p>
        </div>
        <div className="text-[#2dd4bf] text-2xl leading-none flex-shrink-0" style={VT}>
          {Math.round(progress)}%
        </div>
      </div>

      <div className="w-full h-4 bg-purple-100 border border-purple-200 p-0.5">
        <div className="h-full bg-[#2dd4bf] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {goal.streak > 0 && (
            <>
              <div className="w-2 h-2 bg-[#f472b6] animate-pulse flex-shrink-0" />
              <span className="text-[#f472b6] text-[10px] uppercase tracking-widest font-bold" style={PIXEL}>
                {goal.streak}D STREAK
              </span>
            </>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => setShowLog((v) => !v)}
            className="text-[9px] px-2 py-1.5 bg-[#5b21b6] text-white hover:bg-[#4c1d95] transition-colors flex items-center gap-1"
            style={PIXEL}
          >
            <Clock className="w-3 h-3" />
            LOG
          </button>
          <button
            onClick={() => onArchive(goal.id)}
            className="text-[#a78bfa] hover:text-[#5b21b6] p-1.5 border border-transparent hover:border-[#ddd6fe]"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-[#a78bfa]/80 mt-2 italic" style={VT}>
        💡 {getAtomicTip(goal.category)}
      </p>

      {showLog && (
        <div className="mt-3 pt-3 border-t border-dashed border-[#ddd6fe] space-y-2">
          <div className="flex gap-2">
            <Input
              type="number"
              step={logStep(unit)}
              min="0"
              value={logAmount}
              onChange={(e) => setLogAmount(e.target.value)}
              className="h-8 text-sm border-[#ddd6fe] focus-visible:ring-[#5b21b6]"
              placeholder={logPlaceholder(unit)}
            />
          </div>
          <Textarea
            placeholder="What did you work on? (optional)"
            value={logNotes}
            onChange={(e) => setLogNotes(e.target.value)}
            className="min-h-[60px] text-sm border-[#ddd6fe] focus-visible:ring-[#5b21b6]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleLog}
              className="flex-1 py-2 bg-[#2dd4bf] text-white text-[10px] hover:bg-[#14b8a6] transition-colors"
              style={PIXEL}
            >
              LOG PROGRESS
            </button>
            <button
              onClick={() => setShowLog(false)}
              className="px-3 py-2 text-[10px] text-[#a78bfa] hover:text-[#5b21b6]"
              style={PIXEL}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddGoalDialog({ onAdd, trigger }: { onAdd: (g: any) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<"monthly" | "ongoing">("monthly");
  const [targetUnit, setTargetUnit] = useState<GoalTargetUnit>("hours");
  const [targetAmount, setTargetAmount] = useState("10");
  const [category, setCategory] = useState("general");

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    if (isReadingCategory(value)) {
      setTargetUnit("pages");
      setTargetAmount(defaultTargetForUnit("pages"));
      setGoalType("ongoing");
    } else {
      setTargetUnit("hours");
      setTargetAmount(defaultTargetForUnit("hours"));
    }
  };

  const handleUnitChange = (value: GoalTargetUnit) => {
    setTargetUnit(value);
    setTargetAmount(defaultTargetForUnit(value));
    if (isBookCompletionUnit(value)) setGoalType("ongoing");
  };

  const bookCompletion = isBookCompletionUnit(targetUnit);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const resolvedType = bookCompletion ? "ongoing" : goalType;
    const endDate =
      resolvedType === "monthly"
        ? endOfMonthDateString()
        : undefined;
    onAdd({
      title,
      description,
      goal_type: resolvedType,
      target_hours: parseFloat(targetAmount) || parseFloat(defaultTargetForUnit(targetUnit)),
      target_unit: targetUnit,
      category,
      end_date: endDate,
    });
    setTitle("");
    setDescription("");
    setTargetUnit("hours");
    setTargetAmount("10");
    setCategory("general");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white border-2 border-[#ddd6fe]">
        <DialogHeader>
          <DialogTitle className="text-[#5b21b6] text-sm" style={PIXEL}>PLANT A NEW GOAL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-[#5b21b6] text-[10px]" style={PIXEL}>WHAT</Label>
            <Input placeholder={isReadingCategory(category) ? "e.g. Half A Yellow Sun" : "e.g. Work out regularly"} value={title} onChange={(e) => setTitle(e.target.value)} className="border-[#ddd6fe]" />
          </div>
          <div>
            <Label className="text-[#5b21b6] text-[10px]" style={PIXEL}>WHY</Label>
            <Textarea placeholder="Your motivation" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px] border-[#ddd6fe]" />
          </div>
          <div className={`grid gap-3 ${bookCompletion ? "grid-cols-1" : "grid-cols-2"}`}>
            <div>
              <Label className="text-[#5b21b6] text-[10px]" style={PIXEL}>CATEGORY</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="border-[#ddd6fe]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!bookCompletion && (
              <div>
                <Label className="text-[#5b21b6] text-[10px]" style={PIXEL}>TYPE</Label>
                <Select value={goalType} onValueChange={(v) => setGoalType(v as "monthly" | "ongoing")}>
                  <SelectTrigger className="border-[#ddd6fe]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {isReadingCategory(category) && (
            <div>
              <Label className="text-[#5b21b6] text-[10px]" style={PIXEL}>TRACK BY</Label>
              <Select value={targetUnit} onValueChange={(v) => handleUnitChange(v as GoalTargetUnit)}>
                <SelectTrigger className="border-[#ddd6fe]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {READING_TARGET_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {bookCompletion && (
            <div className="p-3 bg-purple-50 border-2 border-[#ddd6fe]">
              <p className="text-xs text-[#5b21b6]" style={VT}>
                Pages and chapters track progress through the whole book — not a monthly target.
              </p>
            </div>
          )}
          <div>
            <Label className="text-[#5b21b6] text-[10px]" style={PIXEL}>
              {targetLabel(targetUnit, goalType)}
            </Label>
            <Input
              type="number"
              min="1"
              step={logStep(targetUnit)}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="border-[#ddd6fe]"
            />
          </div>
          <div className="p-3 bg-purple-50 border-2 border-[#ddd6fe]">
            <p className="text-xs text-[#5b21b6]" style={VT}>
              <span className="font-bold" style={PIXEL}>TIP: </span>
              Start small. The habit matters more than the amount.
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full py-3 bg-[#5b21b6] text-white text-[10px] hover:bg-[#4c1d95] disabled:opacity-50 transition-colors"
            style={PIXEL}
          >
            CREATE GOAL
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionsPanel({
  suggestions,
  onDismiss,
  onAccept,
  onIntegrateAll,
  onClose,
  integrating,
}: {
  suggestions: GoalSuggestion[];
  onDismiss: (idx: number) => void;
  onAccept: (s: GoalSuggestion) => void;
  onIntegrateAll: () => void;
  onClose: () => void;
  integrating: boolean;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white border-2 border-[#2dd4bf] p-4 shadow-[4px_4px_0px_#2dd4bf] mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-[#2dd4bf]" />
          <h3 className="text-[#5b21b6] text-[11px]" style={PIXEL}>A POTENTIAL ROUTE</h3>
        </div>
        <button onClick={onClose} className="text-[#a78bfa] hover:text-[#5b21b6]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[#a78bfa] text-base mb-3" style={VT}>
        One way to fit your goals into today&apos;s open time.
      </p>
      <button
        type="button"
        onClick={onIntegrateAll}
        disabled={integrating}
        className="mb-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#2dd4bf] text-white text-[10px] hover:bg-[#14b8a6] disabled:opacity-50 transition-colors"
        style={PIXEL}
      >
        <CalendarPlus className={`w-3.5 h-3.5 ${integrating ? "animate-pulse" : ""}`} />
        {integrating ? "ADDING TO SCHEDULE..." : "ADD ALL TO MAIN SCHEDULE"}
      </button>
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 border-2 border-[#ddd6fe]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 bg-[#5b21b6] text-white" style={PIXEL}>
                  {s.startTime}–{s.endTime}
                </span>
                <span className="text-sm text-[#a78bfa]" style={VT}>{s.durationMinutes}min</span>
              </div>
              <p className="text-sm text-[#5b21b6] font-medium">{s.activity}</p>
              <p className="text-base text-[#a78bfa]" style={VT}>For: {s.goalTitle}</p>
              <p className="text-xs text-[#a78bfa]/80 italic mt-1">💡 {s.reason}</p>
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                className="p-1.5 text-[#2dd4bf] hover:bg-[#2dd4bf] hover:text-white border border-[#2dd4bf]"
                onClick={() => onAccept(s)}
                title="Accept"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 text-[#a78bfa] hover:bg-[#ddd6fe] border border-[#ddd6fe]"
                onClick={() => onDismiss(i)}
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, color = "#5b21b6" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white border-2 border-[#ddd6fe] p-3 flex flex-col items-center justify-center shadow-[4px_4px_0px_#ddd6fe]">
      <span className="text-[9px] text-[#a78bfa] uppercase font-bold mb-1 text-center" style={PIXEL}>
        {label}
      </span>
      <span className="text-3xl font-bold leading-none" style={{ ...VT, color }}>
        {value}
      </span>
    </div>
  );
}

export default function Goals() {
  const { user } = useAuth();
  const { goals, loading, addGoal, logProgress, archiveGoal } = useGoals();
  const { loadTodaySchedule, saveSchedule } = useSchedulePersistence(user?.id);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [integratingSuggestions, setIntegratingSuggestions] = useState(false);
  const [celebratingGoal, setCelebratingGoal] = useState<GoalWithProgress | null>(null);
  const celebratedIdsRef = useRef<Set<string>>(new Set());
  const prevCompleteRef = useRef<Set<string>>(new Set());
  const goalsInitializedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    celebratedIdsRef.current = loadCelebratedGoalIds(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loading) return;

    const completeNow = goals.filter(isGoalComplete);
    const completeIds = new Set(completeNow.map((g) => g.id));

    if (!goalsInitializedRef.current) {
      goalsInitializedRef.current = true;
      let backfilled = false;
      for (const goal of completeNow) {
        if (celebratedIdsRef.current.has(goal.id)) continue;
        celebratedIdsRef.current.add(goal.id);
        backfilled = true;
      }
      if (backfilled) saveCelebratedGoalIds(user.id, celebratedIdsRef.current);
      prevCompleteRef.current = completeIds;
      return;
    }

    for (const goal of completeNow) {
      if (prevCompleteRef.current.has(goal.id) || celebratedIdsRef.current.has(goal.id)) continue;
      celebratedIdsRef.current.add(goal.id);
      saveCelebratedGoalIds(user.id, celebratedIdsRef.current);
      setCelebratingGoal(goal);
      break;
    }

    prevCompleteRef.current = completeIds;
  }, [goals, user?.id, loading]);


  const totalStreak = goals.reduce((max, g) => Math.max(max, g.streak), 0);
  const totalHoursThisMonth = goals.reduce((sum, g) => {
    const thisMonth = localMonthString();
    const monthLogs = g.logs.filter((l) => l.log_date.startsWith(thisMonth));
    return sum + monthLogs.reduce((s, l) => s + Number(l.hours_logged), 0);
  }, 0);

  const handleFindGaps = async () => {
    const activeGoals = goals.filter((g) => !isGoalComplete(g));
    if (activeGoals.length === 0) {
      toast.error(goals.length === 0 ? "Create some goals first!" : "All your goals are complete — nothing to schedule!");
      return;
    }
    setLoadingSuggestions(true);
    try {
      const result = await loadTodaySchedule();
      const schedule = result?.schedule || [];
      const settings = result?.settings;

      const { data, error } = await supabase.functions.invoke("suggest-goal-blocks", {
        body: {
          schedule,
          goals: activeGoals.map((g) => ({
            id: g.id,
            title: g.title,
            category: g.category,
            target_hours: g.target_hours,
            target_unit: g.target_unit,
            totalLogged: g.totalLogged,
            goal_type: g.goal_type,
          })),
          wakeTime: settings?.wakeTime || "07:00",
          bedTime: settings?.bedTime || "23:00",
        },
      });

      if (error) throw error;
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        if (data.suggestions.length === 0) {
          toast("No free gaps found — your day is packed!", { icon: "📋" });
        } else {
          toast.success(`Found ${data.suggestions.length} open blocks for a potential route!`);
        }
      }
    } catch (e: any) {
      console.error("Suggestion error:", e);
      toast.error(e?.message || "Failed to get suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAcceptSuggestion = async (s: GoalSuggestion) => {
    try {
      const result = await loadTodaySchedule();
      const existing = result?.schedule ?? [];
      const settings = result?.settings ?? defaultScheduleSettings;
      const [newItem] = goalSuggestionsToScheduleItems([s]);
      const merged = mergeScheduleItems(existing, [newItem]);
      await saveSchedule(merged, settings);
      toast.success(`Added "${s.activity}" at ${s.startTime} to today's schedule!`, { icon: "✅" });
      setSuggestions((prev) => prev.filter((x) => x !== s));
    } catch (e) {
      console.error("Failed to merge goal suggestion:", e);
      toast.error("Could not add goal block to your schedule");
    }
  };

  const handleIntegrateAllSuggestions = async () => {
    if (suggestions.length === 0) return;
    setIntegratingSuggestions(true);
    try {
      const result = await loadTodaySchedule();
      const existing = result?.schedule ?? [];
      const settings = result?.settings ?? defaultScheduleSettings;
      const newItems = goalSuggestionsToScheduleItems(suggestions);
      const merged = mergeScheduleItems(existing, newItems);
      await saveSchedule(merged, settings);
      toast.success(`Added ${newItems.length} goal blocks to today's main schedule!`, { icon: "✅" });
      setSuggestions([]);
    } catch (e) {
      console.error("Failed to integrate goal route:", e);
      toast.error("Could not add this route to your schedule");
    } finally {
      setIntegratingSuggestions(false);
    }
  };

  const handleDismissSuggestion = (idx: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="min-h-screen w-full bg-[#fdfaff] p-4 md:p-8">
      <SEO title="Long-Term Goals — TimeBunny" description="Track Atomic-Habits-style long-term goals and let TimeBunny suggest tasks that fill the gaps in your day." path="/goals" />
      <GoalCarrotCelebration goal={celebratingGoal} onDismiss={() => setCelebratingGoal(null)} />

      <div className="max-w-2xl w-full mx-auto space-y-8">
        {/* Top nav */}
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 text-[#5b21b6] hover:bg-purple-100 hover:text-[#5b21b6] text-[10px]" style={PIXEL}>
              <ArrowLeft className="w-3.5 h-3.5" />
              BACK
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/badges">
              <button
                className="flex items-center gap-2 text-[10px] px-3 py-2 bg-white border-2 border-[#ddd6fe] text-[#5b21b6] hover:bg-purple-50 shadow-[2px_2px_0px_#ddd6fe]"
                style={PIXEL}
              >
                <Award className="w-3.5 h-3.5 text-[#2dd4bf]" />
                BADGES
              </button>
            </Link>
            {goals.length > 0 && (
              <button
                onClick={handleFindGaps}
                disabled={loadingSuggestions}
                className="flex items-center gap-2 text-[10px] px-3 py-2 bg-white border-2 border-[#ddd6fe] text-[#5b21b6] hover:bg-purple-50 disabled:opacity-50 shadow-[2px_2px_0px_#ddd6fe]"
                style={PIXEL}
              >
                <Wand2 className={`w-3.5 h-3.5 ${loadingSuggestions ? "animate-spin" : ""}`} />
                {loadingSuggestions ? "FINDING..." : "FIND GAPS"}
              </button>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-[#5b21b6] text-lg md:text-2xl tracking-tighter" style={PIXEL}>
            LONG-TERM GOALS
          </h1>
          <div className="h-1 w-24 bg-[#99f6e4] mx-auto shadow-[2px_2px_0px_#5b21b6]" />
          <p className="text-[#a78bfa] text-base md:text-lg max-w-md mx-auto px-4" style={VT}>
            "You do not rise to the level of your goals. You fall to the level of your systems."
            <br />— James Clear
          </p>
        </div>

        {/* Suggestions */}
        <SuggestionsPanel
          suggestions={suggestions}
          onDismiss={handleDismissSuggestion}
          onAccept={handleAcceptSuggestion}
          onIntegrateAll={handleIntegrateAllSuggestions}
          onClose={() => setSuggestions([])}
          integrating={integratingSuggestions}
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Active" value={String(goals.length)} />
          <StatTile label="Streak" value={`${totalStreak}d`} color="#f472b6" />
          <StatTile label="Hours" value={totalHoursThisMonth.toFixed(1)} color="#2dd4bf" />
        </div>

        {/* Empty state — Atomic Habits */}
        {goals.length === 0 && !loading && (
          <div className="bg-white border-2 border-[#ddd6fe] p-6 shadow-[4px_4px_0px_#ddd6fe] space-y-4">
            <h2 className="text-[#5b21b6] text-[11px] text-center" style={PIXEL}>
              BUILD SYSTEMS, NOT JUST GOALS
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "👁️", title: "OBVIOUS", desc: "Clear cues — time & place" },
                { icon: "💎", title: "ATTRACTIVE", desc: "Pair with what you enjoy" },
                { icon: "🎯", title: "EASY", desc: "Start with 2-min version" },
                { icon: "🏆", title: "SATISFYING", desc: "Track & celebrate" },
              ].map((p) => (
                <div key={p.title} className="p-3 border-2 border-[#ddd6fe]">
                  <span className="text-lg">{p.icon}</span>
                  <p className="text-[9px] text-[#5b21b6] mt-1" style={PIXEL}>{p.title}</p>
                  <p className="text-sm text-[#a78bfa]" style={VT}>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals list */}
        {loading ? (
          <div className="text-center py-12 text-[#a78bfa] text-lg" style={VT}>
            Loading your goals...
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onLog={logProgress} onArchive={archiveGoal} />
            ))}
          </div>
        )}

        {/* Plant new goal */}
        <AddGoalDialog
          onAdd={addGoal}
          trigger={
            <button
              className="w-full py-4 border-2 border-dashed border-[#ddd6fe] text-[#a78bfa] hover:text-[#5b21b6] hover:border-[#5b21b6] transition-all flex items-center justify-center gap-3 text-[10px]"
              style={PIXEL}
            >
              <Plus className="w-4 h-4" />
              PLANT NEW GOAL
            </button>
          }
        />

        <footer className="text-center pt-4">
          <p className="text-sm text-[#a78bfa]/70 italic" style={VT}>
            "Every action you take is a vote for the type of person you wish to become." — Atomic Habits
          </p>
        </footer>
      </div>
    </div>
  );
}
