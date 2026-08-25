import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Moon, Sun, Coffee, Battery, BatteryLow, Heart, Zap, Clock, Calendar, X, PlayCircle, Plus, AlertTriangle, Trash2, Loader2, CheckCircle2, PartyPopper, ArrowRight, ArrowLeft, Search, Save, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserSettings, EnergyLevel, StressLevel, ScheduleItem, DEFAULT_SCHEDULE_SUIT } from "@/types/schedule";
import CalendarImportModal, { CalendarEvent } from "./CalendarImportModal";
import JournalBookModal from "./JournalBookModal";
import JournalReferencePicker from "./JournalReferencePicker";
import JournalEditor, { type JournalEditorHandle } from "./JournalEditor";
import type { JournalReferenceInsert } from "@/lib/journalReferences";
import { journalContentToPlainText } from "@/lib/journalReferences";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import {
  buildCalendarAnalysisPrompt,
  buildVibeChecksPrompt,
  type ScheduleGenerationContext,
} from "@/lib/scheduleOptimizationContext";
import type { VibeCheckEntry } from "@/hooks/useSchedulePersistence";
import { getFormattedDate, getTimeOfDayGreeting, getDayName } from "@/lib/dayGreetings";
import { useAuth } from "@/hooks/useAuth";
import { useGoals } from "@/hooks/useGoals";
import { useSchedulePersistence, saveScheduleSnapshot } from "@/hooks/useSchedulePersistence";
import { buildGoalsSchedulePrompt, formatGoalsForSchedule, formatPomodoroTimer, getItemDurationMinutes, getPomodoroDurationSeconds, resolveGoalIdFromItem } from "@/lib/goalsSchedule";
import { CALENDAR_SYNCED_EVENT } from "@/lib/calendarSync";
import { CRITICAL_ONLY_COMFORT_MESSAGES } from "@/lib/vibeStressDetection";
import {
  clearPomodoroSession,
  computeRemainingSeconds,
  findTaskForSession,
  loadPomodoroSession,
  savePomodoroSession,
} from "@/lib/pomodoroSessionPersistence";
import {
  isCriticalScheduleTask,
  pickCriticalVictoryMessage,
  playCompletionDing,
  playCriticalVictoryFanfare,
  startTimerUpAlarm,
  stopTimerUpAlarm,
} from "@/lib/pomodoroBunny";
import { toast } from "sonner";
import { markCalendarEventComplete } from "@/lib/calendar/markCalendarEventComplete";
import { resolveCalendarEventForScheduleItem } from "@/lib/calendar/scheduleCalendarMatch";
import { loadJournalSpeechBubblePosition } from "@/lib/journalSpeechBubblePosition";
import { supabase } from "@/integrations/supabase/client";
import PomodoroBunnyCompanion from "@/components/PomodoroBunnyCompanion";
import LofiRadioButton from "@/components/LofiRadioButton";
import { useLofiRadio } from "@/hooks/useLofiRadio";
import libraryBg from "@/assets/library-background.png";
import cozyBg from "@/assets/cozy-background.png";
import scheduleBg from "@/assets/schedule-background.png";
import bunnyMascot from "@/assets/bunny-mascot.png";
import speechBubbleWelcome from "@/assets/speech-bubble-welcome.png";
import journalBook from "@/assets/journal-book.png";

interface TaskEntry {
  id: string;
  title: string;
  duration: string;
  deadline: string;
  priority: "high" | "medium" | "low";
}

interface WizardInterfaceProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  onComplete: (tasks: string, context?: ScheduleGenerationContext) => void;
  isLoading: boolean;
  generatedSchedule: ScheduleItem[];
  initialScene?: Scene;
  onBackFromInitial?: () => void;
  onUpdateSchedule?: () => void;
  onScheduleChange?: (items: ScheduleItem[]) => void;
  /** Neurosymbolic calendar analysis from analyze-calendar-tasks */
  analyzedCalendarTasks?: AnalyzedTask[];
  /** When true, cozy journal is mandatory: Skip is hidden and bunny insists on a journal entry. */
  requireJournal?: boolean;
  /** Show bunny comfort dialogue (e.g. after critical-only vibe check). */
  comfortMode?: "critical_only" | null;
  onComfortDismiss?: () => void;
}

// ─── SCENE DEFINITIONS ───
// Each scene has: background image, bunny position, bunny size, dialogue messages
type Scene = "library" | "cozy" | "energy" | "stress" | "schedule";

/** Journal / energy / stress — +2 paces up & right, midsize scale on chair */
const WIREframe_CHAIR_BUNNY = {
  position: "bottom-[calc(17%+4rem)] left-[calc(73%+4rem)] -translate-x-1/2",
  size: "w-[28rem] sm:w-[32rem] md:w-[36rem] lg:w-[38rem]",
  scale: "origin-bottom scale-[1.75]",
  backgroundClass: "object-cover object-center",
} as const;

const COZY_CHAIR_BUNNY = {
  position: "bottom-[calc(17%+1rem)] left-[calc(73%+4rem)] -translate-x-1/2",
  size: WIREframe_CHAIR_BUNNY.size,
  scale: WIREframe_CHAIR_BUNNY.scale,
  backgroundClass: "object-cover object-right-bottom",
} as const;

/** Energy / stress / schedule — chair anchor on schedule background */
const ENERGY_STRESS_CHAIR_BUNNY = {
  position: "bottom-[calc(17%+2rem)] left-[calc(73%+4rem)] -translate-x-1/2",
  size: WIREframe_CHAIR_BUNNY.size,
  scale: "origin-bottom scale-[2.25]",
  backgroundClass: WIREframe_CHAIR_BUNNY.backgroundClass,
} as const;

/** Speech bubble — journal scene (absolute tuning) */
const JOURNAL_SPEECH_BUBBLE_DEFAULT_POS =
  "bottom-[72%] -left-[18rem] sm:-left-[22rem] md:-left-[26rem]";

const WIREframe_SPEECH_BUBBLE = {
  journal: `absolute z-50 pointer-events-none w-60 sm:w-72 ${JOURNAL_SPEECH_BUBBLE_DEFAULT_POS}`,
} as const;

/** Energy / stress — beside scaled bunny head (layout box ≠ visual size after scale) */
const ENERGY_STRESS_SPEECH_BUBBLE_CLASS =
  "absolute z-50 pointer-events-none w-56 sm:w-64 right-[calc(100%-1.65rem)] sm:right-[calc(100%-1.5rem)] -top-[48%] sm:-top-[52%] -translate-y-36";

const SCENE_CONFIG = {
  library: {
    background: libraryBg,
    bunnyPosition: "bottom-[0%] right-[-1%]",
    bunnySize: "w-[22rem]",
    backgroundClass: "object-cover object-center",
    hideBubble: false,
    messages: [
      `${getTimeOfDayGreeting()}! It's ${getFormattedDate()} 🗓️`,
      "Hi there, my name is TimeBunny! Welcome to my home!",
      "Tap Next when you're ready and we'll continue to your journal.",
    ],
  },
  cozy: {
    background: cozyBg,
    bunnyPosition: COZY_CHAIR_BUNNY.position,
    bunnySize: COZY_CHAIR_BUNNY.size,
    bunnyScale: COZY_CHAIR_BUNNY.scale,
    backgroundClass: COZY_CHAIR_BUNNY.backgroundClass,
    hideBubble: false,
    messages: [
      "Great! Now that I have a better understanding of what your day is like, let's get started!",
      "Life can get messy and chaotic with responsibilities, school, work etc. It's hard to keep track of everything",
      "Here is a safe space for you to write about your day, tell me what's going on. I'm all ears",
      "Let it out, write it out! Click on the notepad to write about your day 📝",
    ],
  },
  energy: {
    background: scheduleBg,
    bunnyPosition: ENERGY_STRESS_CHAIR_BUNNY.position,
    bunnySize: ENERGY_STRESS_CHAIR_BUNNY.size,
    bunnyScale: ENERGY_STRESS_CHAIR_BUNNY.scale,
    backgroundClass: ENERGY_STRESS_CHAIR_BUNNY.backgroundClass,
    hideBubble: false,
    messages: [
      "Wow! You have a lot on your plate dear, what is your energy level?",
    ],
  },
  stress: {
    background: scheduleBg,
    bunnyPosition: ENERGY_STRESS_CHAIR_BUNNY.position,
    bunnySize: ENERGY_STRESS_CHAIR_BUNNY.size,
    bunnyScale: ENERGY_STRESS_CHAIR_BUNNY.scale,
    backgroundClass: ENERGY_STRESS_CHAIR_BUNNY.backgroundClass,
    hideBubble: false,
    messages: [
      "How is your stress level?",
    ],
  },
  schedule: {
    background: scheduleBg,
    bunnyPosition: ENERGY_STRESS_CHAIR_BUNNY.position,
    bunnySize: ENERGY_STRESS_CHAIR_BUNNY.size,
    bunnyScale: ENERGY_STRESS_CHAIR_BUNNY.scale,
    backgroundClass: ENERGY_STRESS_CHAIR_BUNNY.backgroundClass,
    hideBubble: true,
    messages: [],
  },
} as const;

type WizardStep = "greeting" | "mood" | "stress" | "sleep" | "breaks" | "tasks";

const WizardInterface = ({ settings, onSettingsChange, onComplete, isLoading, generatedSchedule, initialScene = "library", onBackFromInitial, onUpdateSchedule, onScheduleChange, analyzedCalendarTasks = [], requireJournal = false, comfortMode = null, onComfortDismiss }: WizardInterfaceProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { goals, addGoalProgress } = useGoals();
  const formattedGoals = useMemo(() => formatGoalsForSchedule(goals), [goals]);
  const { saveJournal, loadTodaySchedule, saveSchedule } = useSchedulePersistence(user?.id);
  // ─── SCENE STATE (single source of truth) ───
  const [scene, setScene] = useState<Scene>(initialScene);
  const [step, setStep] = useState<WizardStep>("tasks");

  useEffect(() => {
    setScene(initialScene);
  }, [initialScene]);

  const [breakFrequency, setBreakFrequency] = useState<"minimal" | "moderate" | "frequent">("moderate");
  const [taskEntries, setTaskEntries] = useState<TaskEntry[]>([
    { id: "1", title: "", duration: "", deadline: "", priority: "medium" },
  ]);

  useEffect(() => {
    if (formattedGoals.length === 0) return;
    setTaskEntries((prev) => {
      const existingGoalIds = new Set(
        prev.filter((t) => t.id.startsWith("goal-")).map((t) => t.id),
      );
      const goalTasks: TaskEntry[] = formattedGoals
        .filter((g) => !existingGoalIds.has(`goal-${g.id}`))
        .map((g) => ({
          id: `goal-${g.id}`,
          title: `🎯 ${g.title}`,
          duration: `${g.suggestedDailyMinutes}m`,
          deadline: "",
          priority: g.remainingHours > g.target_hours * 0.5 ? "high" : "medium",
        }));
      if (goalTasks.length === 0) return prev;
      const onlyEmptyDefault =
        prev.length === 1 && !prev[0].title.trim() && !prev[0].duration && !prev[0].deadline;
      return onlyEmptyDefault ? [...goalTasks, ...prev] : [...goalTasks, ...prev];
    });
  }, [formattedGoals]);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [importedEvents, setImportedEvents] = useState<CalendarEvent[]>([]);
  const [persistedCalendarAnalysis, setPersistedCalendarAnalysis] = useState<AnalyzedTask[]>([]);
  const [persistedVibeChecks, setPersistedVibeChecks] = useState<VibeCheckEntry[]>([]);

  const calendarAnalysis = useMemo(() => {
    if (analyzedCalendarTasks.length > 0) return analyzedCalendarTasks;
    return persistedCalendarAnalysis;
  }, [analyzedCalendarTasks, persistedCalendarAnalysis]);

  useEffect(() => {
    loadTodaySchedule().then((session) => {
      if (session?.calendarImport?.length) {
        setPersistedCalendarAnalysis(session.calendarImport);
      }
      if (session?.vibeChecks?.length) {
        setPersistedVibeChecks(session.vibeChecks);
      }
    });
  }, [loadTodaySchedule]);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const tasks = (event as CustomEvent<{ tasks: AnalyzedTask[] }>).detail?.tasks;
      if (tasks?.length) {
        setPersistedCalendarAnalysis(tasks);
      }
    };
    window.addEventListener(CALENDAR_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(CALENDAR_SYNCED_EVENT, onSynced);
  }, []);

  useEffect(() => {
    if (analyzedCalendarTasks.length > 0) {
      setPersistedCalendarAnalysis(analyzedCalendarTasks);
    }
  }, [analyzedCalendarTasks]);
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isAutoAdvancePending, setIsAutoAdvancePending] = useState(false);
  const [bubbleClickCount, setBubbleClickCount] = useState(0);
  const [journalText, setJournalText] = useState("");
  const [isJournalFocused, setIsJournalFocused] = useState(false);
  const journalEditorRef = useRef<JournalEditorHandle>(null);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [draftResumed, setDraftResumed] = useState(false);
  const journalBubblePos = useMemo(() => loadJournalSpeechBubblePosition(), []);

  // Local draft key so unsent text survives exits even before Supabase autosave fires
  const draftKey = user ? `journal-draft-${user.id}` : "journal-draft-anon";

  // Hydrate journal draft: prefer local draft, fallback to saved schedule
  useEffect(() => {
    try {
      const local = localStorage.getItem(draftKey);
      if (local && local.trim()) {
        setJournalText((cur) => cur || local);
        setDraftResumed(true);
      }
    } catch {}
    if (!user) return;
    loadTodaySchedule().then((r) => {
      if (r?.journalText) {
        setJournalText((cur) => cur || r.journalText);
        if (r.journalText.trim()) setDraftResumed(true);
      }
    });
  }, [user]);

  // Auto-open the journal panel when a draft is resumed so users see it immediately
  useEffect(() => {
    if (draftResumed && scene === "cozy") setIsJournalFocused(true);
  }, [draftResumed, scene]);

  useEffect(() => {
    if (isJournalFocused && scene === "cozy") {
      requestAnimationFrame(() => journalEditorRef.current?.focus());
    }
  }, [isJournalFocused, scene]);

  // Dismiss the "resumed" indicator after a few seconds
  useEffect(() => {
    if (!draftResumed) return;
    const t = setTimeout(() => setDraftResumed(false), 4000);
    return () => clearTimeout(t);
  }, [draftResumed]);


  // Debounced save of journal text (localStorage immediately + Supabase after 800ms)
  useEffect(() => {
    try { localStorage.setItem(draftKey, journalText); } catch {}
    if (!user) return;
    const t = setTimeout(() => { saveJournal(journalText); }, 800);
    return () => clearTimeout(t);
  }, [journalText, user]);

  const [activeTask, setActiveTask] = useState<ScheduleItem | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [draftSchedule, setDraftSchedule] = useState<ScheduleItem[]>([]);
  const [showUpNext, setShowUpNext] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDuration, setTimerDuration] = useState(0); // total seconds
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comfortMessageIndexRef = useRef(0);
  const comfortIntroShownRef = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState("");
  const [celebrationIsCritical, setCelebrationIsCritical] = useState(false);
  const [criticalVictoryTick, setCriticalVictoryTick] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [markingCalendarEvent, setMarkingCalendarEvent] = useState(false);
  const pomodoroRestoredRef = useRef(false);
  const { playing: lofiPlaying, toggle: toggleLofi, currentTrack: lofiTrack } = useLofiRadio(
    scene === "schedule" && !!activeTask,
  );
  const activeTaskRef = useRef<ScheduleItem | null>(null);
  const timerSecondsRef = useRef(0);
  const timerDurationRef = useRef(0);
  const timerRunningRef = useRef(false);
  const timerCompleteChimePlayedRef = useRef(false);

  useEffect(() => {
    activeTaskRef.current = activeTask;
    timerSecondsRef.current = timerSeconds;
    timerDurationRef.current = timerDuration;
    timerRunningRef.current = timerRunning;
  }, [activeTask, timerSeconds, timerDuration, timerRunning]);

  // Freeze & pause the timer when this view unmounts (e.g. vibe check navigation).
  useEffect(() => {
    return () => {
      const task = activeTaskRef.current;
      if (!task || timerSecondsRef.current <= 0) return;

      savePomodoroSession({
        taskId: task.id,
        taskTitle: task.title,
        taskTime: task.time,
        timerSeconds: timerSecondsRef.current,
        timerDuration: timerDurationRef.current,
        timerRunning: false,
        savedAt: new Date().toISOString(),
      });
    };
  }, []);

  // Restore an in-progress Pomodoro after vibe check (or other route) unmounts this view.
  useEffect(() => {
    if (pomodoroRestoredRef.current || generatedSchedule.length === 0) return;

    const saved = loadPomodoroSession();
    if (!saved) return;

    const task = findTaskForSession(generatedSchedule, saved);
    if (!task) return;

    pomodoroRestoredRef.current = true;
    const remaining = computeRemainingSeconds(saved);

    setActiveTask(task);
    setTimerDuration(saved.timerDuration);
    setTimerSeconds(remaining);
    setTimerRunning(saved.timerRunning && remaining > 0);
  }, [generatedSchedule]);

  useEffect(() => {
    if (!activeTask) return;

    savePomodoroSession({
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      taskTime: activeTask.time,
      timerSeconds,
      timerDuration,
      timerRunning,
      savedAt: new Date().toISOString(),
    });
  }, [activeTask, timerSeconds, timerDuration, timerRunning]);

  const celebrationMessages = [
    "You crushed it! On to the next one~",
    "Amazing work! You're unstoppable!",
    "That's how it's done! Keep this energy!",
    "So proud of you! One step closer to greatness!",
    "Brilliant! You're on fire today!",
    "Task conquered! You're a legend!",
    "Yay! Another one done! Let's keep rolling~",
  ];

  // Timer countdown effect
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [timerRunning]);

  // Soft kawaii chime when the countdown naturally reaches zero.
  useEffect(() => {
    if (
      activeTask &&
      timerDuration > 0 &&
      timerSeconds === 0 &&
      !timerRunning &&
      !timerCompleteChimePlayedRef.current
    ) {
      timerCompleteChimePlayedRef.current = true;
      startTimerUpAlarm();
      return;
    }

    if (timerSeconds > 0 || !activeTask) {
      timerCompleteChimePlayedRef.current = false;
    }
  }, [activeTask, timerDuration, timerSeconds, timerRunning]);

  useEffect(() => () => stopTimerUpAlarm(), []);

  const startTask = (item: ScheduleItem) => {
    stopTimerUpAlarm();
    const totalSec = getPomodoroDurationSeconds(item, generatedSchedule, { bedTime: settings.bedTime });
    setActiveTask(item);
    setTimerDuration(totalSec);
    setTimerSeconds(totalSec);
    setTimerRunning(true);
  };

  const getCurrentScheduleTask = (items: ScheduleItem[]): ScheduleItem | null => {
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let best = sorted[0];
    for (const item of sorted) {
      const [h, m] = item.time.split(":").map(Number);
      if (h * 60 + m <= currentMinutes) best = item;
      else break;
    }
    return best;
  };

  const handleStartFocusTimer = () => {
    const task = getCurrentScheduleTask(generatedSchedule);
    if (task) startTask(task);
  };

  const stopTask = () => {
    stopTimerUpAlarm();
    setActiveTask(null);
    setTimerRunning(false);
    setTimerSeconds(0);
    clearPomodoroSession();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const runCompletionCelebration = useCallback(
    (task: ScheduleItem, isCritical: boolean) => {
      const celebrationMs = isCritical ? 5500 : 4000;
      const showOverlay = () => setShowCelebration(true);
      if (isCritical) {
        setTimeout(showOverlay, 1100);
      } else {
        showOverlay();
      }

      setTimeout(() => {
        setShowCelebration(false);
        setCelebrationIsCritical(false);
        const sorted = [...generatedSchedule].sort((a, b) => a.time.localeCompare(b.time));
        const currentIdx = sorted.findIndex((s) => s.id === task.id);
        if (currentIdx < sorted.length - 1) {
          startTask(sorted[currentIdx + 1]);
        } else {
          stopTask();
        }
      }, celebrationMs);
    },
    [generatedSchedule],
  );

  const applyTaskFullyComplete = useCallback(
    (task: ScheduleItem) => {
      stopTimerUpAlarm();
      const remaining = generatedSchedule.filter((s) => s.id !== task.id);
      onScheduleChange?.(remaining);
      setTimerRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveTask(null);
      setTimerSeconds(0);
      clearPomodoroSession();
      toast.success("Task marked complete!");
    },
    [generatedSchedule, onScheduleChange],
  );

  const completeSession = useCallback(() => {
    if (!activeTask) return;

    stopTimerUpAlarm();

    const isCritical = isCriticalScheduleTask(activeTask, calendarAnalysis, comfortMode);
    if (isCritical) {
      playCriticalVictoryFanfare();
      setCriticalVictoryTick((t) => t + 1);
      setCelebrationMsg(pickCriticalVictoryMessage());
      setCelebrationIsCritical(true);
    } else {
      playCompletionDing();
      setCelebrationMsg(celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)]);
      setCelebrationIsCritical(false);
    }

    const goalId = resolveGoalIdFromItem(activeTask, goals);
    if (goalId && user) {
      const elapsedSec = Math.max(0, timerDuration - timerSeconds);
      const scheduledMinutes = getItemDurationMinutes(activeTask, generatedSchedule, { bedTime: settings.bedTime });
      const hours =
        elapsedSec >= 60 ? elapsedSec / 3600 : Math.max(scheduledMinutes / 60, 0.25);
      addGoalProgress(goalId, hours, `Session: ${activeTask.title}`, true);
      toast.success(`+${Math.round(hours * 60)} min logged toward your goal 🎯`);
    }

    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);

    runCompletionCelebration(activeTask, isCritical);
  }, [
    activeTask,
    generatedSchedule,
    goals,
    user,
    timerDuration,
    timerSeconds,
    addGoalProgress,
    calendarAnalysis,
    comfortMode,
    runCompletionCelebration,
  ]);

  const markTaskComplete = useCallback(async () => {
    if (!activeTask || completedTasks.has(activeTask.id) || markingCalendarEvent) return;

    setCompletedTasks((prev) => new Set(prev).add(activeTask.id));
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const linkedCalendarEvent = resolveCalendarEventForScheduleItem(activeTask, calendarAnalysis);
    if (linkedCalendarEvent) {
      setMarkingCalendarEvent(true);
      try {
        const result = await markCalendarEventComplete(linkedCalendarEvent);
        if (result.ok) {
          toast.success(result.message ?? "Marked done in Google Calendar.");
          setPersistedCalendarAnalysis((prev) =>
            prev.filter((t) => t.id !== linkedCalendarEvent.eventId),
          );
        } else if (result.openedExternally) {
          toast.info(result.message ?? "Opened Google Calendar.");
        } else {
          toast.error(result.message ?? "Could not update Google Calendar.");
        }
      } finally {
        setMarkingCalendarEvent(false);
      }
    }

    applyTaskFullyComplete(activeTask);
  }, [
    activeTask,
    calendarAnalysis,
    completedTasks,
    markingCalendarEvent,
    applyTaskFullyComplete,
  ]);

  const formatTimer = formatPomodoroTimer;

  useEffect(() => {
    if (scene === "schedule" && comfortMode !== "critical_only") {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
        typeIntervalRef.current = null;
      }
      if (pendingSpeechTimeoutRef.current) {
        clearTimeout(pendingSpeechTimeoutRef.current);
        pendingSpeechTimeoutRef.current = null;
      }
      setIsAutoAdvancePending(false);
      setIsTyping(false);
      setTypedText("");
      setBubbleClickCount(0);
      setShowSpeechBubble(false);
    }
  }, [scene, comfortMode]);

  useEffect(
    () => () => {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
      if (pendingSpeechTimeoutRef.current) clearTimeout(pendingSpeechTimeoutRef.current);
    },
    [],
  );

  const nowStr = (() => {
    const n = new Date();
    return `${n.getHours().toString().padStart(2, "0")}:${n.getMinutes().toString().padStart(2, "0")}`;
  })();
  const [startTime, setStartTime] = useState(nowStr);

  const config = SCENE_CONFIG[scene];
  const isChairScene = scene === "cozy" || scene === "energy" || scene === "stress" || scene === "schedule";
  const isWireframeChairScene = scene === "cozy" || scene === "energy" || scene === "stress";
  const isEnergyStressScene = scene === "energy" || scene === "stress";
  const isJournalScene = scene === "cozy";
  const wireframeSpeechBubbleClass = isJournalScene ? WIREframe_SPEECH_BUBBLE.journal : undefined;
  const bunnyScaleClass = "bunnyScale" in config ? (config as { bunnyScale?: string }).bunnyScale : undefined;


  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // ─── TYPEWRITER HELPER ───
  const clearSpeechTimers = () => {
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
    if (pendingSpeechTimeoutRef.current) {
      clearTimeout(pendingSpeechTimeoutRef.current);
      pendingSpeechTimeoutRef.current = null;
    }
  };

  const typeMessage = useCallback((msg: string, onDone?: () => void) => {
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
    if (!msg) {
      setTypedText("");
      setIsTyping(false);
      onDone?.();
      return;
    }
    setIsTyping(true);
    let i = 1;
    setTypedText(msg.slice(0, 1));
    if (msg.length <= 1) {
      setIsTyping(false);
      onDone?.();
      return;
    }
    typeIntervalRef.current = setInterval(() => {
      i++;
      setTypedText(msg.slice(0, i));
      if (i >= msg.length) {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
        onDone?.();
      }
    }, 40);
  }, []);

  const showBunnyMessage = useCallback(
    (msg: string, onDone?: () => void) => {
      clearSpeechTimers();
      setIsAutoAdvancePending(false);
      setBubbleClickCount(1);
      setShowSpeechBubble(true);
      typeMessage(msg, onDone);
    },
    [typeMessage],
  );

  // Auto-show bunny comfort when entering critical-only schedule mode
  useEffect(() => {
    if (scene !== "schedule" || comfortMode !== "critical_only") {
      comfortIntroShownRef.current = false;
      return;
    }
    if (comfortIntroShownRef.current) return;
    if (isLoading && generatedSchedule.length === 0) return;

    comfortIntroShownRef.current = true;
    comfortMessageIndexRef.current = 0;
    showBunnyMessage(CRITICAL_ONLY_COMFORT_MESSAGES[0]);
  }, [scene, comfortMode, isLoading, generatedSchedule.length, showBunnyMessage]);

  useEffect(() => {
    if (comfortMode !== "critical_only") comfortIntroShownRef.current = false;
  }, [comfortMode]);

  const scheduleSpeech = useCallback((fn: () => void, delayMs: number) => {
    if (pendingSpeechTimeoutRef.current) {
      clearTimeout(pendingSpeechTimeoutRef.current);
    }
    pendingSpeechTimeoutRef.current = setTimeout(() => {
      pendingSpeechTimeoutRef.current = null;
      fn();
    }, delayMs);
  }, []);

  const handleCalendarImport = (events: CalendarEvent[]) => {
    setImportedEvents(events);
    clearSpeechTimers();
    setScene("cozy");
    // Reset speech bubble state for new scene
    setShowSpeechBubble(false);
    setTypedText("");
    setBubbleClickCount(0);
    setIsAutoAdvancePending(false);
  };

  const removeImportedEvent = (id: string) => {
    setImportedEvents(importedEvents.filter(e => e.id !== id));
  };

  // Distress keyword detection
  const distressKeywords = [
    "failed", "fail", "bombed", "flunked", "messed up",
    "stressed", "overwhelmed", "anxious", "anxiety", "depressed", "sad",
    "can't do this", "give up", "giving up", "hopeless", "worthless",
    "crying", "cried", "terrible", "awful", "horrible", "worst",
    "exhausted", "burned out", "burnout", "broke down", "falling apart",
    "struggling", "lost", "lonely", "scared", "worried", "panicking",
  ];

  const encouragementMessages = [
    "Hey, I hear you. It's okay to have tough days — they don't define you. You're stronger than you think 💛",
    "I know things feel heavy right now, but you've gotten through hard times before and you will again ✨",
    "It's okay to not be okay. Take a breath. I'm here, and we'll figure this out together 🤍",
    "You're doing better than you think. One step at a time — that's all it takes 🌱",
    "Bad moments pass. You're still here, still trying, and that takes real courage 💪",
    "Remember: a setback is a setup for a comeback. Let's make the rest of today count 🌟",
  ];

  const detectDistress = (text: string): boolean => {
    const lower = text.toLowerCase();
    return distressKeywords.some(keyword => lower.includes(keyword));
  };

  const handleInsertJournalReference = useCallback((reference: JournalReferenceInsert) => {
    journalEditorRef.current?.saveSelection();
    journalEditorRef.current?.insertReference(reference);
  }, []);

  // Called when user clicks "Generate Schedule" in the journal
  const handleComplete = () => {
    setIsJournalFocused(false);
    setIsAutoAdvancePending(false);

    // Save the journal entry with its timestamp to the user's book
    const entryText = journalText.trim();
    if (entryText && user) {
      supabase
        .from("journal_entries")
        .insert({ user_id: user.id, content: entryText })
        .then(({ error }) => {
          if (error) console.error("Failed to save journal entry:", error);
        });
    }
    // Clear local draft once the entry is sent
    try { localStorage.removeItem(draftKey); } catch {}


    // Check for distress in journal text — show encouragement first
    if (detectDistress(journalContentToPlainText(journalText))) {
      const msg = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
      setScene("energy");
      showBunnyMessage(msg, () => {
        setIsAutoAdvancePending(true);
        scheduleSpeech(() => {
          setIsAutoAdvancePending(false);
          setBubbleClickCount(2);
          typeMessage("Now, let's take care of you. What is your energy level?");
        }, 3000);
      });
      return;
    }

    // No distress — normal flow
    setScene("energy");
    showBunnyMessage("How is your energy level?");
  };

  const handleSaveSchedule = async () => {
    if (generatedSchedule.length === 0) {
      toast.info("There's no schedule to save yet.");
      return;
    }
    await saveSchedule(generatedSchedule, settings);
    toast.success("Schedule saved! You can find it in your journal book.");
  };

  // Called after energy level is selected
  const submitSchedule = () => {
    const breakText = breakFrequency === "minimal" ? "Include minimal short breaks" 
      : breakFrequency === "moderate" ? "Include regular 15-minute breaks every 2 hours"
      : "Include frequent breaks - 10 minutes every hour";
    
    const validTasks = taskEntries.filter(t => t.title.trim());
    const tasksText = validTasks.map(t => {
      let line = `- ${t.title}`;
      if (t.duration) line += ` (estimated: ${t.duration})`;
      if (t.deadline) line += ` ⏰ DEADLINE: ${t.deadline}`;
      if (t.priority === "high") line += ` 🔴 HIGH PRIORITY`;
      else if (t.priority === "low") line += ` 🟢 LOW PRIORITY`;
      return line;
    }).join('\n');

    const deadlineTasks = validTasks.filter(t => t.deadline);
    const deadlineWarning = deadlineTasks.length > 0
      ? `\n\n🚨 DEADLINE ALERT: ${deadlineTasks.length} task(s) have deadlines. These MUST be completed before their deadline times. Schedule them with enough buffer time to finish. If a deadline is tight, WARN me.`
      : '';

    const eventsList = importedEvents.length > 0 
      ? `\n\n⚠️ FIXED CALENDAR EVENTS — These are immutable time blocks. Schedule everything else AROUND them:\n${importedEvents.map(e => 
          `- [FIXED] ${e.title} (${e.isAllDay ? 'All day' : `${e.startTime} - ${e.endTime}`})${e.description ? ` — ${e.description}` : ''}`
        ).join('\n')}\n\nPlease include these fixed events in the final schedule output and fill the gaps between them with my tasks.`
      : '';

    const calendarAnalysisPrompt = buildCalendarAnalysisPrompt(calendarAnalysis);
    const vibeChecksPrompt = buildVibeChecksPrompt(persistedVibeChecks);

    const startNote = `\n\nSchedule starts NOW at ${startTime} (current real time). Only schedule tasks from this time onwards, not from wake time.\nUse all of this context (journal, calendar, vibe, current time, bedtime). Work and homework must finish BEFORE wind-down or bedtime — never after the user retires for the night.`;

    const journalNote = journalText.trim()
      ? `\n\nHere's what the user wrote about their day:\n"${journalContentToPlainText(journalText.trim())}"\nPlease incorporate any mentioned tasks, commitments, or context into the schedule.`
      : "";

    const goalsPrompt = buildGoalsSchedulePrompt(formattedGoals);
    
    onComplete(
      `My tasks:\n${tasksText}${deadlineWarning}${eventsList}${calendarAnalysisPrompt}${vibeChecksPrompt}${journalNote}${goalsPrompt}${startNote}\n\n${breakText}`,
      {
        calendarAnalysis,
        vibeChecks: persistedVibeChecks,
        optimizeMode: "default",
        existingSchedule: generatedSchedule,
      },
    );
  };

  // ─── BUNNY CLICK HANDLER ───
  const handleBunnyClick = () => {
    if (isTyping || isAutoAdvancePending) return;
    if (scene === "cozy" && isJournalFocused) return;
    // Energy/stress use button-driven dialogue — ignore clicks to avoid message flicker
    if (scene === "energy" || scene === "stress") return;

    if (scene === "schedule" && comfortMode === "critical_only") {
      const nextIndex =
        (comfortMessageIndexRef.current + 1) % CRITICAL_ONLY_COMFORT_MESSAGES.length;
      comfortMessageIndexRef.current = nextIndex;
      setBubbleClickCount(nextIndex + 1);
      showBunnyMessage(CRITICAL_ONLY_COMFORT_MESSAGES[nextIndex]);
      return;
    }

    if (config.hideBubble) {
      clearSpeechTimers();
      setShowSpeechBubble(false);
      setTypedText("");
      onComfortDismiss?.();
      return;
    }

    const messages = config.messages;
    const maxMessages = messages.length;
    const nextCount = bubbleClickCount + 1;

    // Dismiss bubble after all messages shown
    if (showSpeechBubble && nextCount >= maxMessages + 1) {
      setShowSpeechBubble(false);
      setTypedText("");
      setBubbleClickCount(0);
      return;
    }

    const msgIndex = showSpeechBubble ? Math.min(nextCount - 1, messages.length - 1) : 0;
    const resetCount = showSpeechBubble ? nextCount : 1;
    setBubbleClickCount(resetCount);
    setShowSpeechBubble(true);

    const fullText = messages[msgIndex];
    if (!fullText) return;
    typeMessage(fullText, () => {
      // Auto-advance in cozy scene: "Life can get messy..." → 2s → "Here is a safe space..."
      if (scene === "cozy" && fullText === SCENE_CONFIG.cozy.messages[1]) {
        setIsAutoAdvancePending(true);
        scheduleSpeech(() => {
          const autoMsg = SCENE_CONFIG.cozy.messages[2];
          setBubbleClickCount(prev => prev + 1);
          setIsAutoAdvancePending(false);
          typeMessage(autoMsg);
        }, 2000);
      }
    });
  };

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col" style={{ background: "hsl(280 40% 85%)" }}>
      {/* Background image — driven by scene */}
      <AnimatePresence mode="wait">
        <motion.img
          key={config.background}
          src={config.background}
          alt=""
          className={`absolute inset-0 w-full h-full ${config.backgroundClass ?? "object-cover object-center"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      </AnimatePresence>

      {/* Journal book icon — cozy scene only, opens saved entries */}
      {scene === "cozy" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsBookOpen(true); }}
          aria-label="Open my journal book"
          title="My journal"
          className="absolute top-4 left-4 z-[30] w-16 h-16 rounded-xl bg-card/80 backdrop-blur-sm border-2 border-primary/40 shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        >
          <img
            src={journalBook}
            alt="Journal book"
            width={48}
            height={48}
            loading="lazy"
            className="w-12 h-12 [image-rendering:pixelated] drop-shadow"
          />
        </button>
      )}

      <JournalBookModal open={isBookOpen} onClose={() => setIsBookOpen(false)} />


      {/* Journal overlay — cozy scene only */}
      {scene === "cozy" && (
        <div
          className={`absolute inset-0 ${isJournalFocused ? "z-[40]" : "z-[15]"} cursor-text`}
          onClick={() => setIsJournalFocused(true)}
        >
          <AnimatePresence>
            {isJournalFocused && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute top-[8%] left-[8%] right-[40%] bottom-[15%]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative w-full h-full bg-card/90 backdrop-blur-md rounded-xl border border-primary/20 shadow-xl p-4">
                  <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                    <JournalReferencePicker
                      calendarEvents={importedEvents}
                      analyzedTasks={calendarAnalysis}
                      scheduleItems={generatedSchedule}
                      tasks={taskEntries.map((t) => ({
                        id: t.id,
                        title: t.title,
                        deadline: t.deadline,
                      }))}
                      onBeforeOpen={() => journalEditorRef.current?.saveSelection()}
                      onInsert={handleInsertJournalReference}
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsBookOpen(true); }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Search past entries"
                      title="Search past entries"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsJournalFocused(false); }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close journal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground mb-2 pr-16" style={{ fontFamily: "var(--font-body)" }}>📝 Write about your day...</p>
                  {draftResumed && (
                    <div
                      className="mb-2 inline-block text-[0.7rem] px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/30"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      ✨ Resumed your unsent draft
                    </div>
                  )}

                  <JournalEditor
                    ref={journalEditorRef}
                    value={journalText}
                    onChange={setJournalText}
                    placeholder="What's on your mind today?"
                    className="w-full bg-transparent focus:outline-none"
                    style={{
                      height: journalText.trim() ? "calc(100% - 4.5rem)" : "calc(100% - 2rem)",
                    }}
                  />
                  {journalText.trim() && (
                    <div className="absolute bottom-3 left-4 right-4 z-20">
                      <Button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleComplete(); }}
                        disabled={isLoading}
                        className="w-full text-lg"
                        size="lg"
                        style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', cursive" }}
                      >
                        {isLoading ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Energy level buttons — energy scene only */}
      <AnimatePresence>
        {scene === "energy" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute left-[4%] top-[22%] z-10 flex flex-col gap-4 sm:gap-5"
          >
            {(["high", "standard", "low"] as const).map((level) => (
              <button
                key={level}
                onClick={() => {
                  updateSetting("energyLevel", level === "high" ? "motivated" : "unmotivated");
                  setScene("stress");
                  showBunnyMessage("How is your stress level?");
                }}
                className="px-10 py-3 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95"
                style={{ background: "hsl(197 71% 73%)" }}
              >
                <span className="pixel-title-alt text-xl" style={{ color: "hsl(330 80% 55%)" }}>
                  {level}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stress level buttons — stress scene only */}
      <AnimatePresence>
        {scene === "stress" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute left-[4%] top-[22%] z-10 flex flex-col gap-4 sm:gap-5"
          >
            {(["high", "average", "low"] as const).map((level) => (
              <button
                key={level}
                onClick={() => {
                  updateSetting("stressLevel", level === "average" ? "medium" : level);

                  if (level === "high") {
                    // Show encouragement before generating schedule
                    const stressEncouragements = [
                      "I can see you're under a lot of pressure. Let me build you a gentle schedule with extra breaks 💛",
                      "High stress? I've got you. I'll make sure to add calming moments throughout your day 🌿",
                      "You're carrying a lot right now. Let's lighten the load together — I'll keep things manageable ✨",
                    ];
                    const msg = stressEncouragements[Math.floor(Math.random() * stressEncouragements.length)];
                    showBunnyMessage(msg, () => {
                      scheduleSpeech(() => {
                        submitSchedule();
                        setScene("schedule");
                      }, 2500);
                    });
                    return;
                  }

                  clearSpeechTimers();
                  submitSchedule();
                  setScene("schedule");
                }}
                className="px-10 py-3 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95"
                style={{ background: "hsl(50 100% 50%)" }}
              >
                <span className="pixel-title-alt text-xl" style={{ color: "hsl(120 60% 20%)" }}>
                  {level}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule display — schedule scene */}
      {scene === "schedule" && (
        <div className="absolute inset-0 z-[15] flex items-center justify-start p-8">
          <div className="max-w-md w-full max-h-[80vh] overflow-y-auto">
            {isLoading && generatedSchedule.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4 p-8"
              >
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "hsl(280 40% 50%)" }} />
                <p className="pixel-title-alt text-lg" style={{ color: "hsl(280 40% 40%)" }}>
                  Creating your schedule...
                </p>
              </motion.div>
            ) : activeTask ? (
              <>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
                style={{ background: "hsl(300 50% 88%)" }}
              >
                <LofiRadioButton
                  playing={lofiPlaying}
                  trackTitle={lofiTrack?.title}
                  trackArtist={lofiTrack?.artist}
                  onToggle={toggleLofi}
                  className="fixed top-4 left-4 z-[60]"
                />

                {/* Clock outline background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  <div
                    className="rounded-full absolute"
                    style={{
                      width: "140vmax",
                      height: "140vmax",
                      border: "16px solid hsl(90 80% 45%)",
                      background: "hsl(40 60% 95%)",
                    }}
                  >
                    <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[16px] h-[60px] rounded-full" style={{ background: "hsl(90 80% 45%)" }} />
                    <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[16px] h-[60px] rounded-full" style={{ background: "hsl(90 80% 45%)" }} />
                    <div className="absolute left-[2%] top-1/2 -translate-y-1/2 w-[60px] h-[16px] rounded-full" style={{ background: "hsl(90 80% 45%)" }} />
                    <div className="absolute right-[2%] top-1/2 -translate-y-1/2 w-[60px] h-[16px] rounded-full" style={{ background: "hsl(90 80% 45%)" }} />
                    <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[10px] h-[30%] rounded-full origin-bottom rotate-[30deg]" style={{ background: "hsl(90 80% 45% / 0.7)" }} />
                    <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[8px] h-[35%] rounded-full origin-bottom rotate-[-60deg]" style={{ background: "hsl(90 80% 45% / 0.7)" }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ background: "hsl(90 80% 45%)" }} />
                  </div>
                </div>

                {/* Clock tick marks */}
                <div className="absolute inset-0 pointer-events-none z-[1] flex items-center justify-center">
                  <div className="relative" style={{ width: "min(150vw, 150vh)", height: "min(150vw, 150vh)" }}>
                    {Array.from({ length: 60 }).map((_, i) => {
                      const isHour = i % 5 === 0;
                      const angle = i * 6;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom"
                          style={{ height: "50%", transform: `translateX(-50%) rotate(${angle}deg)` }}
                        >
                          <div
                            className="rounded-full mx-auto"
                            style={{
                              width: isHour ? "6px" : "3px",
                              height: isHour ? "24px" : "12px",
                              background: isHour ? "hsl(90 80% 45% / 0.7)" : "hsl(90 80% 45% / 0.3)",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Up Next tab - positioned top-left */}
                {(() => {
                  const sorted = [...generatedSchedule].sort((a, b) => a.time.localeCompare(b.time));
                  const currentIdx = sorted.findIndex(s => s.id === activeTask.id);
                  const earlier = currentIdx > 0 ? sorted.slice(0, currentIdx) : [];
                  const upcoming = sorted.slice(currentIdx + 1);
                  return (
                    <motion.div
                      drag
                      dragMomentum={false}
                      dragElastic={0}
                      className="absolute top-24 left-6 z-20 w-64 cursor-grab active:cursor-grabbing"
                      style={{ touchAction: "none" }}
                    >
                      {/* Tab header */}
                      <button
                        onClick={() => setShowUpNext(prev => !prev)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-t-2xl shadow-lg transition-all hover:brightness-105"
                        style={{
                          background: "hsl(280 30% 92%)",
                          border: "2px solid hsl(280 30% 75%)",
                          borderBottom: showUpNext ? "none" : undefined,
                          borderRadius: showUpNext ? "1rem 1rem 0 0" : "1rem",
                        }}
                      >
                        <span className="text-xs opacity-40 mr-1">⠿</span>
                        <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}>
                          Up Next
                        </span>
                        <motion.span
                          animate={{ rotate: showUpNext ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ color: "hsl(280 40% 50%)" }}
                        >
                          ▼
                        </motion.span>
                      </button>

                      {/* Expandable task list */}
                      <AnimatePresence>
                        {showUpNext && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden rounded-b-2xl shadow-lg"
                            style={{
                              background: "hsl(280 30% 96%)",
                              border: "2px solid hsl(280 30% 75%)",
                              borderTop: "1px solid hsl(280 30% 85%)",
                            }}
                          >
                            <div className="max-h-[50vh] overflow-y-auto p-2 space-y-1.5">
                              {earlier.length > 0 && (
                                <div className="space-y-1.5 pb-1.5 mb-1.5" style={{ borderBottom: "1px solid hsl(280 30% 85%)" }}>
                                  <p className="text-[10px] uppercase tracking-wider px-1" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 55%)" }}>
                                    Earlier today
                                  </p>
                                  {earlier.map((item) => (
                                    <button
                                      key={item.id}
                                      onClick={() => startTask(item)}
                                      className="w-full text-left px-3 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] opacity-70"
                                      style={{
                                        background: item.title.toLowerCase().includes("break")
                                          ? "hsl(150 50% 85%)"
                                          : "hsl(280 30% 92%)",
                                        border: `1.5px solid ${item.title.toLowerCase().includes("break") ? "hsl(150 40% 65%)" : "hsl(280 30% 80%)"}`,
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] shrink-0" style={{ color: "hsl(0 0% 0%)", fontFamily: "'Squartiqa 4F', 'Share Tech Mono', monospace" }}>
                                          {(() => {
                                            const [h, m] = item.time.split(":");
                                            const hour = parseInt(h);
                                            const ampm = hour >= 12 ? "PM" : "AM";
                                            const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                            return `${h12}:${m} ${ampm}`;
                                          })()}
                                        </span>
                                        <span className="text-xs font-semibold truncate" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}>
                                          {item.title}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {upcoming.length === 0 && earlier.length === 0 ? (
                                <p className="text-xs text-center py-3" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 50%)" }}>
                                  No more tasks — you're done! ✧
                                </p>
                              ) : (
                                upcoming.map((item, i) => (
                                  <button
                                    key={item.id}
                                    onClick={() => startTask(item)}
                                    className="w-full text-left px-3 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    style={{
                                      background: item.title.toLowerCase().includes("break")
                                        ? "hsl(150 50% 85%)"
                                        : "hsl(280 30% 92%)",
                                      border: `1.5px solid ${item.title.toLowerCase().includes("break") ? "hsl(150 40% 65%)" : "hsl(280 30% 80%)"}`,
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] shrink-0" style={{ color: "hsl(0 0% 0%)", fontFamily: "'Squartiqa 4F', 'Share Tech Mono', monospace" }}>
                                        {(() => {
                                          const [h, m] = item.time.split(":");
                                          const hour = parseInt(h);
                                          const ampm = hour >= 12 ? "PM" : "AM";
                                          const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                          return `${h12}:${m} ${ampm}`;
                                        })()}
                                      </span>
                                      <span className="text-xs font-semibold truncate" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}>
                                        {item.title}
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })()}

                {/* Timer content */}
                <div className="relative z-10 flex flex-col items-center gap-6 mt-[25vh]">

                {/* Now Working On header */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-80 rounded-2xl p-4 text-center shadow-lg"
                  style={{ background: "hsl(280 30% 92% / 0.9)", border: "2px solid hsl(280 30% 75%)", backdropFilter: "blur(8px)" }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(280 40% 50%)", fontFamily: "var(--font-body)" }}>
                    Now Working On
                  </span>
                  <h2 className="text-xl font-bold mt-1" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}>
                    {activeTask.title}
                  </h2>
                  {activeTask.description && (
                    <p className="text-xs mt-1 opacity-70" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 35%)" }}>
                      {activeTask.description}
                    </p>
                  )}
                </motion.div>

                {/* Countdown timer */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="text-6xl font-bold tracking-wider"
                    style={{ fontFamily: "'SCR N Seven', 'Share Tech Mono', monospace", color: "hsl(280 40% 30%)" }}
                  >
                    {formatTimer(timerSeconds)}
                  </div>
                  <p className="text-xs" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 50%)" }}>
                    {timerSeconds === 0 ? "Time's up!" : timerRunning ? "In progress..." : "Paused"}
                  </p>
                </div>

                {/* Timer controls */}
                <div className="flex gap-3 flex-wrap justify-center">
                  {timerRunning ? (
                    <button
                      onClick={() => setTimerRunning(false)}
                      className="px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
                      style={{ background: "hsl(45 90% 55%)", fontFamily: "var(--font-body)" }}
                    >
                      Pause
                    </button>
                  ) : timerSeconds > 0 ? (
                    <button
                      onClick={() => setTimerRunning(true)}
                      className="px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
                      style={{ background: "hsl(150 50% 65%)", fontFamily: "var(--font-body)" }}
                    >
                      Resume
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      saveScheduleSnapshot(generatedSchedule, settings);
                      navigate("/vibe-check", { state: { fromPomodoro: true, schedule: generatedSchedule } });
                    }}
                    className="px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-white"
                    style={{ background: "hsl(210 90% 55%)", fontFamily: "var(--font-body)" }}
                    title="Need a break? Feeling distracted or overwhelmed?"
                  >
                    <Sparkles className="w-4 h-4" />
                    Vibe Check
                  </button>
                  <button
                    onClick={completeSession}
                    className="px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    style={{ background: "hsl(150 60% 55%)", fontFamily: "var(--font-body)", color: "white" }}
                    title="Finish this focus session and move to the next block"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Session Done
                  </button>
                  <button
                    onClick={stopTask}
                    className="px-6 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
                    style={{ background: "hsl(350 60% 75%)", fontFamily: "var(--font-body)" }}
                  >
                    {timerSeconds === 0 ? "Back to Schedule" : "Stop"}
                  </button>
                </div>

                {/* Progress bar */}
                {timerDuration > 0 && (
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "hsl(280 20% 85%)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "hsl(280 40% 55%)" }}
                      animate={{ width: `${((timerDuration - timerSeconds) / timerDuration) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
                </div>

                {/* Celebration Overlay */}
                <AnimatePresence>
                  {showCelebration && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
                      style={{ background: "hsl(300 50% 88% / 0.95)", backdropFilter: "blur(12px)" }}
                    >
                      {/* Confetti particles */}
                      {Array.from({ length: 24 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-3 h-3 rounded-full"
                          style={{
                            background: ["hsl(280 60% 60%)", "hsl(330 80% 60%)", "#ffd700", "#ff69b4", "hsl(150 60% 55%)", "hsl(45 90% 55%)"][i % 6],
                            left: `${10 + Math.random() * 80}%`,
                            top: `${Math.random() * 30}%`,
                          }}
                          initial={{ opacity: 0, y: -20, scale: 0 }}
                          animate={{
                            opacity: [0, 1, 1, 0],
                            y: [0, 100 + Math.random() * 300],
                            x: [-30 + Math.random() * 60],
                            scale: [0, 1.2, 0.8, 0],
                            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                          }}
                          transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5, ease: "easeOut" }}
                        />
                      ))}

                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.3, 1] }}
                        transition={{ duration: 0.5, ease: "backOut" }}
                      >
                        <PartyPopper className="w-16 h-16 mb-6" style={{ color: "hsl(280 50% 55%)" }} />
                      </motion.div>

                      {/* Bunny celebration */}
                      <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: [0, 1.1, 1], rotate: [-10, 5, 0] }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                      >
                        <img
                          src={bunnyMascot}
                          alt="Celebrating bunny"
                          className={`object-contain drop-shadow-xl pixel-img ${
                            celebrationIsCritical
                              ? "w-56 h-56 animate-bunny-victory"
                              : "w-48 h-48"
                          }`}
                          draggable={false}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-center mt-4 px-8"
                      >
                        <p
                          className={`font-bold ${celebrationIsCritical ? "text-3xl" : "text-2xl"}`}
                          style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}
                        >
                          {celebrationMsg}
                        </p>
                        <p className="text-sm mt-2 opacity-70" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 40%)" }}>
                          {celebrationIsCritical ? "Critical task complete — hero mode!" : "Moving to next task..."}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              <PomodoroBunnyCompanion
                active={!!activeTask && !showCelebration}
                victoryTrigger={criticalVictoryTick}
              />

              <button
                type="button"
                onClick={markTaskComplete}
                disabled={completedTasks.has(activeTask.id) || markingCalendarEvent}
                className="fixed bottom-4 right-4 z-[55] flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                style={{ background: "hsl(280 70% 50%)" }}
                title="The whole task is finished — can mark it off your calendar too"
                aria-label="Mark task complete"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {completedTasks.has(activeTask.id) ? "Task Complete" : markingCalendarEvent ? "Updating calendar…" : "Mark Task Complete"}
              </button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between w-full gap-2">
                  <button
                    onClick={handleSaveSchedule}
                    className="px-5 py-2 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md text-white font-semibold text-sm flex items-center gap-2"
                    style={{ background: "hsl(210 90% 55%)", fontFamily: "var(--font-body)" }}
                    aria-label="Save generated schedule"
                  >
                    <Save className="w-4 h-4" />
                    Save Schedule
                  </button>
                  <button
                    onClick={handleStartFocusTimer}
                    disabled={generatedSchedule.length === 0}
                    className="px-5 py-2 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md text-white font-semibold text-sm disabled:opacity-50 disabled:pointer-events-none"
                    style={{ background: "hsl(150 60% 45%)", fontFamily: "var(--font-body)" }}
                  >
                    Pomodoro Timer →
                  </button>
                </div>
                {[...generatedSchedule].sort((a, b) => a.time.localeCompare(b.time)).map((item, index) => {
                  const taskFinished = completedTasks.has(item.id);
                  return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    onClick={() => !taskFinished && startTask(item)}
                    disabled={taskFinished}
                    className={`w-full text-left px-5 py-3 rounded-2xl transition-all shadow-md ${
                      taskFinished ? "opacity-50 cursor-default" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                    style={{
                      background: item.title.toLowerCase().includes("break")
                        ? "hsl(150 50% 85%)"
                        : "hsl(280 30% 92%)",
                      border: `2px solid ${item.title.toLowerCase().includes("break") ? "hsl(150 40% 65%)" : "hsl(280 30% 75%)"}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs shrink-0" style={{ color: "hsl(0 0% 0%)", fontFamily: "'Squartiqa 4F', 'Share Tech Mono', monospace" }}>
                        {(() => {
                          const [h, m] = item.time.split(":");
                          const hour = parseInt(h);
                          const ampm = hour >= 12 ? "PM" : "AM";
                          const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                          return `${h12}:${m} ${ampm}`;
                        })()}
                      </span>
                      <span className={`text-sm font-semibold ${taskFinished ? "line-through" : ""}`} style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}>
                        {item.title}
                        {taskFinished && " ✓"}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs mt-1 ml-12 opacity-70" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 35%)" }}>
                        {item.description}
                      </p>
                    )}
                  </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Yellow manual edit button (bottom-right) */}
          {!activeTask && generatedSchedule.length > 0 && (
            <button
              onClick={() => {
                setDraftSchedule([...generatedSchedule].sort((a, b) => a.time.localeCompare(b.time)));
                setEditingSchedule(true);
              }}
              className="fixed bottom-6 right-6 z-40 px-5 py-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-semibold text-sm"
              style={{
                background: "hsl(48 100% 60%)",
                color: "hsl(30 60% 20%)",
                border: "3px solid hsl(30 60% 25%)",
                fontFamily: "var(--font-body)",
              }}
              aria-label="Edit schedule manually"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      )}

      {/* Manual schedule editor modal */}
      {editingSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditingSchedule(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            style={{ border: "4px solid hsl(280 40% 20%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b-2" style={{ borderColor: "hsl(280 30% 85%)" }}>
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}>
                Edit Schedule
              </h2>
              <button onClick={() => setEditingSchedule(false)} aria-label="Close editor">
                <X className="w-5 h-5" style={{ color: "hsl(280 40% 25%)" }} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {draftSchedule.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "hsl(280 30% 96%)", border: "2px solid hsl(280 30% 85%)" }}>
                  <input
                    type="time"
                    value={item.time}
                    onChange={(e) => {
                      const next = [...draftSchedule];
                      next[idx] = { ...next[idx], time: e.target.value };
                      setDraftSchedule(next);
                    }}
                    className="px-2 py-1 rounded border text-sm"
                    style={{ borderColor: "hsl(280 30% 75%)", fontFamily: "var(--font-body)" }}
                  />
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const next = [...draftSchedule];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setDraftSchedule(next);
                    }}
                    className="flex-1 px-2 py-1 rounded border text-sm"
                    style={{ borderColor: "hsl(280 30% 75%)", fontFamily: "var(--font-body)" }}
                  />
                  <button
                    onClick={() => setDraftSchedule(draftSchedule.filter((_, i) => i !== idx))}
                    aria-label="Delete task"
                    className="p-2 rounded-lg hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: "hsl(0 60% 50%)" }} />
                  </button>
                </div>
              ))}

              <button
                onClick={() =>
                  setDraftSchedule([
                    ...draftSchedule,
                    {
                      id: `manual-${Date.now()}`,
                      title: "New task",
                      time: "12:00",
                      suit: DEFAULT_SCHEDULE_SUIT,
                    },
                  ])
                }
                className="w-full py-2 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm"
                style={{ background: "hsl(150 60% 90%)", color: "hsl(150 60% 25%)", border: "2px dashed hsl(150 40% 55%)", fontFamily: "var(--font-body)" }}
              >
                <Plus className="w-4 h-4" /> Add task
              </button>
            </div>

            <div className="p-5 border-t-2 flex justify-end gap-2" style={{ borderColor: "hsl(280 30% 85%)" }}>
              <button
                onClick={() => setEditingSchedule(false)}
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{ background: "hsl(280 15% 90%)", color: "hsl(280 40% 25%)", fontFamily: "var(--font-body)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const sorted = [...draftSchedule].sort((a, b) => a.time.localeCompare(b.time));
                  onScheduleChange?.(sorted);
                  setEditingSchedule(false);
                  toast.success("Schedule updated");
                }}
                className="px-4 py-2 rounded-full text-sm font-semibold text-white flex items-center gap-2"
                style={{ background: "hsl(210 90% 55%)", fontFamily: "var(--font-body)" }}
              >
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bunny mascot — position & size driven by scene config */}
      {!(scene === "schedule" && activeTask) && (
      <div
        className={`absolute transition-all duration-700 ${config.bunnyPosition} ${
          isChairScene ? "z-40 overflow-visible" : "z-20"
        } ${scene === "cozy" && isJournalFocused ? "pointer-events-none" : ""}`}
      >
        <div
          className={`relative cursor-pointer overflow-visible ${
            isEnergyStressScene
              ? "inline-block"
              : isChairScene && !isWireframeChairScene
                ? "flex flex-col items-center"
                : isWireframeChairScene
                  ? "max-w-none"
                  : isChairScene
                    ? "max-w-[38rem]"
                    : ""
          } ${scene === "cozy" && isJournalFocused ? "pointer-events-none" : ""}`}
          onClick={handleBunnyClick}
        >
          <AnimatePresence>
            {showSpeechBubble && (comfortMode === "critical_only" || !config.hideBubble) && (
              <motion.div
                key="bunny-speech"
                initial={false}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.2 }}
                className={
                  isEnergyStressScene
                    ? ENERGY_STRESS_SPEECH_BUBBLE_CLASS
                    : wireframeSpeechBubbleClass ??
                      (isChairScene
                        ? "z-50 pointer-events-none w-60 sm:w-72 order-first mb-2"
                        : "z-50 pointer-events-none absolute -top-16 w-72 sm:w-80 right-[60%]")
                }
                style={
                  isJournalScene && journalBubblePos
                    ? { left: journalBubblePos.left, bottom: journalBubblePos.bottom }
                    : undefined
                }
              >
                <div
                  className="relative bg-white p-4 sm:p-5 shadow-xl"
                  style={{
                    borderRadius: "50%",
                    minHeight: "5.5rem",
                    border: "3px solid hsl(280 40% 20%)",
                    outline: "2px solid hsl(280 40% 20%)",
                    outlineOffset: "3px",
                    boxShadow: "4px 4px 0px hsl(280 40% 20%)",
                  }}
                >
                  <p className="text-sm text-center leading-relaxed" style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}>
                    {typedText}
                    {isTyping && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />}
                  </p>
                </div>
                <div className="relative w-full h-10 pointer-events-none">
                  {isWireframeChairScene ? (
                    <>
                      <div className="absolute top-0 left-[78%] w-4 h-4 bg-white border-2 rounded-full" style={{ borderColor: "hsl(280 40% 20%)" }} />
                      <div className="absolute top-3 left-[84%] w-2.5 h-2.5 bg-white border-2 rounded-full" style={{ borderColor: "hsl(280 40% 20%)" }} />
                      <div className="absolute top-6 left-[90%] w-1.5 h-1.5 bg-white border-2 rounded-full" style={{ borderColor: "hsl(280 40% 20%)" }} />
                    </>
                  ) : isChairScene ? (
                    <>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 rounded-full" style={{ borderColor: "hsl(280 40% 20%)" }} />
                      <div className="absolute top-3 left-[54%] w-2.5 h-2.5 bg-white border-2 rounded-full" style={{ borderColor: "hsl(280 40% 20%)" }} />
                      <div className="absolute top-6 left-[58%] w-1.5 h-1.5 bg-white border-2 rounded-full" style={{ borderColor: "hsl(280 40% 20%)" }} />
                    </>
                  ) : (
                    <>
                      <div className="absolute top-0 w-4 h-4 bg-white border-2 rounded-full left-[30%]" style={{ borderColor: "hsl(280 40% 20%)" }} />
                      <div className="absolute top-4 w-2.5 h-2.5 bg-white border-2 rounded-full left-[20%]" style={{ borderColor: "hsl(280 40% 20%)" }} />
                      <div className="absolute top-8 w-1.5 h-1.5 bg-white border-2 rounded-full left-[12%]" style={{ borderColor: "hsl(280 40% 20%)" }} />
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {bunnyScaleClass ? (
            <div className={bunnyScaleClass}>
              <img
                src={bunnyMascot}
                alt="TimeBunny mascot"
                className={`object-contain drop-shadow-xl transition-all duration-700 hover:scale-105 active:scale-95 pixel-img ${config.bunnySize}`}
                draggable={false}
              />
            </div>
          ) : (
            <img
              src={bunnyMascot}
              alt="TimeBunny mascot"
              className={`object-contain drop-shadow-xl transition-all duration-700 hover:scale-105 active:scale-95 pixel-img ${config.bunnySize}`}
              draggable={false}
            />
          )}
        </div>
      </div>
      )}

      <CalendarImportModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        onImport={handleCalendarImport}
      />

      {/* Next button — library welcome scene */}
      {scene === "library" && importedEvents.length === 0 && (
        <button
          onClick={() => handleCalendarImport([])}
          className="fixed bottom-4 right-4 z-50 flex items-center justify-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: "hsl(280 70% 50%)" }}
          aria-label="Continue to journal"
        >
          <span>Next</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      )}

      {/* Skip button — cozy scene only, jumps to energy */}
      {scene === "cozy" && !requireJournal && (
        <button
          onClick={() => {
            setIsJournalFocused(false);
            setIsAutoAdvancePending(false);
            setScene("energy");
            showBunnyMessage("How is your energy level?");
          }}
          className="fixed bottom-4 right-4 z-50 flex items-center justify-center w-12 h-12 rounded-md text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: "hsl(140 60% 45%)" }}
          aria-label="Skip journal and continue to energy"
        >
          Skip
        </button>
      )}



      {/* Back button — fixed top-left, navigates to previous scene */}
      {(() => {
        const prevMap: Record<Scene, Scene | null> = {
          library: null,
          cozy: "library",
          energy: "cozy",
          stress: "energy",
          schedule: "stress",
        };
        const prev = prevMap[scene];
        const atInitial = scene === initialScene;
        const inPomodoro = scene === "schedule" && !!activeTask;
        const canGoBack = !inPomodoro && (atInitial ? !!onBackFromInitial : !!prev);
        if (!canGoBack) return null;
        return (
          <button
            onClick={() => {
              if (atInitial && onBackFromInitial) { onBackFromInitial(); return; }
              if (!prev) return;
              clearSpeechTimers();
              setScene(prev);
              setShowSpeechBubble(false);
              setTypedText("");
              setBubbleClickCount(0);
              setIsAutoAdvancePending(false);
              setIsJournalFocused(false);
            }}
            className="fixed top-4 left-4 z-50 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{ background: "hsl(280 40% 40%)" }}
            aria-label="Go back"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back</span>
          </button>
        );
      })()}

    </div>
  );
};

export default WizardInterface;
