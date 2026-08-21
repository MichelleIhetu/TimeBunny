import { useState, useEffect, useCallback, useMemo } from "react";
import SEO from "@/components/SEO";
import { useClockTick } from "@/hooks/useClockTick";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Target, Calendar } from "lucide-react";
import { getFormattedDate } from "@/lib/dayGreetings";
import { toast } from "sonner";
import WizardInterface from "@/components/WizardInterface";
import LandingBunnySpeech from "@/components/LandingBunnySpeech";
import { useHourlyCheckIn } from "@/hooks/useHourlyCheckIn";
import { useChat } from "@/hooks/useChat";
import { useGoals } from "@/hooks/useGoals";
import { formatGoalsForSchedule } from "@/lib/goalsSchedule";
import { useGoalScheduleSync } from "@/hooks/useGoalScheduleSync";
import {
  buildExistingSchedulePrompt,
  buildVibeChecksPrompt,
  type ScheduleGenerationContext,
} from "@/lib/scheduleOptimizationContext";
import { buildStressSchedulePrompt, detectVibeStressSignals } from "@/lib/vibeStressDetection";
import type { VibeCheckEntry } from "@/hooks/useSchedulePersistence";
import { useAuth } from "@/hooks/useAuth";
import {
  useSchedulePersistence,
  loadScheduleSnapshot,
  hasSyncedCalendarToday,
} from "@/hooks/useSchedulePersistence";
import { SCHEDULE_UPDATE_REQUEST_EVENT } from "@/lib/scheduleUpdateNotice";
import { CALENDAR_SYNCED_EVENT, CALENDAR_SYNC_NOW_EVENT } from "@/lib/calendarSync";
import { setCalendarSyncPaused } from "@/lib/calendarSyncPause";
import { notifyUrgentNewTasks } from "@/lib/urgentScheduleItems";
import { UserSettings, DEFAULT_SCHEDULE_SUIT } from "@/types/schedule";
import { Button } from "@/components/ui/button";
import CalendarAnalysisModal, { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import MonthlyCalendarModal from "@/components/MonthlyCalendarModal";
import { supabase } from "@/integrations/supabase/client";
import { connectGoogleCalendar } from "@/lib/googleCalendarAccess";
import {
  AUTO_FETCH_CALENDAR_KEY,
  isGoogleCalendarOAuthReturn,
  markAutoFetchCalendarAfterSignIn,
} from "@/lib/googleOAuthReturn";
import { saveCalendarSuccessState } from "@/pages/CalendarSuccess";
import {
  addDaysToDateString,
  eventLocalDateString,
  getUserTimezone,
  localDateString,
} from "@/lib/localTime";

const requestGoogleCalendarAccessToken = async (
  forceConsent = false,
): Promise<{ accessToken: string | null; error?: string; redirected?: boolean }> => {
  const result = await connectGoogleCalendar({ forceConsent });
  return { accessToken: result.accessToken ?? null, error: result.error, redirected: result.redirected };
};



const defaultSettings: UserSettings = {
  energyLevel: "motivated",
  stressLevel: "medium",
  wakeTime: "07:00",
  bedTime: "23:00",
};

type ViewMode = "landing" | "wizard" | "schedule";
const RESUME_CALENDAR_ANALYSIS_KEY = "resume_calendar_analysis";
const CALENDAR_OAUTH_ATTEMPT_KEY = "calendar_oauth_attempt";
const WIZARD_SKIP_REQUEST_KEY = "timebunny_skip_to_wizard_requested";
const POST_GOOGLE_AUTH_REDIRECT_KEY = "timebunny_post_google_auth_redirect";
const WELCOME_BACK_WIZARD_KEY = "timebunny_welcome_back_wizard";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [calendarAnalyzing, setCalendarAnalyzing] = useState(false);
  const [analyzedTasks, setAnalyzedTasks] = useState<AnalyzedTask[] | null>(null);
  const [importedCalendarTasks, setImportedCalendarTasks] = useState<AnalyzedTask[]>([]);
  const [showMonthlyCalendar, setShowMonthlyCalendar] = useState(false);
  const [comfortMode, setComfortMode] = useState<"critical_only" | null>(null);

  useClockTick(viewMode === "landing");


  const { isLoading, sendMessage, generatedSchedule, setGeneratedSchedule } = useChat(settings);
  const { goals } = useGoals();
  const formattedGoals = useMemo(() => formatGoalsForSchedule(goals), [goals]);
  const { saveSchedule, loadTodaySchedule, saveCalendarImport } = useSchedulePersistence(user?.id);

  useGoalScheduleSync(generatedSchedule, goals, settings, setGeneratedSchedule, scheduleLoaded);

  const persistGoogleTokens = async (activeSession: any) => {
    const refreshToken = activeSession?.provider_refresh_token as string | undefined;
    if (!refreshToken) return;

    await supabase.functions.invoke("google-token-save", {
      body: {
        refresh_token: refreshToken,
        access_token: activeSession?.provider_token || null,
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/calendar.readonly",
      },
    });
  };

  // Load today's schedule in the background without pulling users off the welcome screen.
  useEffect(() => {
    if (scheduleLoaded) return;
    loadTodaySchedule().then((result) => {
      if (result && result.schedule.length > 0) {
        setGeneratedSchedule(result.schedule);
        if (result.settings) setSettings(result.settings);
      }
      if (result?.calendarImport?.length) {
        setImportedCalendarTasks(result.calendarImport);
      }
      setScheduleLoaded(true);
    });
  }, [scheduleLoaded, loadTodaySchedule]);

  useEffect(() => {
    setCalendarSyncPaused(calendarAnalyzing);
  }, [calendarAnalyzing]);

  useEffect(() => {
    if (viewMode !== "schedule" || !user) return;
    window.dispatchEvent(new CustomEvent(CALENDAR_SYNC_NOW_EVENT));
  }, [viewMode, user]);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ tasks?: AnalyzedTask[] }>).detail;
      if (detail?.tasks) setImportedCalendarTasks(detail.tasks);
    };
    window.addEventListener(CALENDAR_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(CALENDAR_SYNCED_EVENT, onSynced);
  }, []);

  // Save schedule whenever it changes
  useEffect(() => {
    if (generatedSchedule.length > 0 && scheduleLoaded) {
      saveSchedule(generatedSchedule, settings);
    }
  }, [generatedSchedule, settings, scheduleLoaded]);

  const { completeCheckIn } = useHourlyCheckIn({
    enabled: generatedSchedule.length > 0,
    intervalMinutes: 15,
    onCheckInDue: () => {
      navigate("/vibe-check");
    },
  });

  useEffect(() => {
    const state = location.state as { vibeCheckResult?: VibeCheckEntry } | null;
    if (!state?.vibeCheckResult) return;

    const result = state.vibeCheckResult;
    const stress = result.stressSignals ?? detectVibeStressSignals(result);

    completeCheckIn({
      mood: result.mood,
      energy: result.energy,
      taskUpdate: result.notes,
      needBreak: result.needBreak,
    });

    if (stress.criticalOnly) {
      toast("Keeping today to the essentials — only what matters most.");
    } else if (result.mood === "struggling") {
      toast("Hang in there! We've noted your vibe.", { icon: "💪" });
    } else if (result.mood === "great") {
      toast("You're killing it! Updating your schedule…", { icon: "🔥" });
    } else {
      toast("Vibe check complete — refreshing your schedule", { icon: "✨" });
    }
    if (result.needBreak) toast("Adding a break for you — take it easy!", { icon: "☕" });

    const optimizeMode: ScheduleGenerationContext["optimizeMode"] =
      result.adjustSchedule === "reschedule"
        ? "reschedule"
        : result.adjustSchedule === "lighten" || stress.criticalOnly
          ? "critical_only"
          : stress.detected
            ? "lighten"
            : "default";

    loadTodaySchedule().then((session) => {
      const vibeChecks = session?.vibeChecks ?? [];
      const calendarAnalysis = session?.calendarImport ?? importedCalendarTasks;
      const snap = loadScheduleSnapshot();
      const baseSchedule =
        generatedSchedule.length > 0
          ? generatedSchedule
          : session?.schedule?.length
            ? session.schedule
            : snap?.schedule ?? [];

      const stressPrompt = buildStressSchedulePrompt(stress);
      const vibePrompt = buildVibeChecksPrompt(vibeChecks);

      let prompt: string;
      if (baseSchedule.length > 0) {
        prompt = `${buildExistingSchedulePrompt(baseSchedule, optimizeMode)}${vibePrompt}${stressPrompt}\n\nUpdate my schedule for the rest of today based on my vibe check.`;
      } else {
        prompt = `${vibePrompt}${stressPrompt}\n\nBuild a realistic schedule for the rest of today. Use calendar analysis and keep it achievable.`;
      }

      if (optimizeMode === "critical_only") {
        prompt += "\n\nCRITICAL TASKS ONLY — defer all non-essential work.";
      }

      sendMessage(prompt, {
        goals: formattedGoals,
        calendarAnalysis,
        vibeChecks,
        optimizeMode,
      });

      if (optimizeMode === "critical_only") {
        setComfortMode("critical_only");
      }
      setViewMode("schedule");
    });

    window.history.replaceState({}, document.title);
  }, [location.state]);

  // Skip flow from Auth page: jump directly to the journal wizard (cozy scene).
  useEffect(() => {
    const state = location.state as any;
    const storedSkipNonce = sessionStorage.getItem(WIZARD_SKIP_REQUEST_KEY);
    const skipWasJustRequested =
      state?.skipToWizard && state?.skipToWizardNonce && storedSkipNonce === state.skipToWizardNonce;
    if (skipWasJustRequested) {
      sessionStorage.removeItem(WIZARD_SKIP_REQUEST_KEY);
      setViewMode("wizard");
      window.history.replaceState({}, document.title);
    } else if (state?.skipToWizard) {
      setViewMode("landing");
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Open monthly calendar when navigated from floating nav (or deep links).
  useEffect(() => {
    const state = location.state as { openMonthlyCalendar?: boolean } | null;
    if (!state?.openMonthlyCalendar) return;

    setShowMonthlyCalendar(true);
    window.history.replaceState({}, document.title);
  }, [location.state]);

  useEffect(() => {
    const onOpenSchedule = () => {
      setViewMode("schedule");
    };
    window.addEventListener(SCHEDULE_UPDATE_REQUEST_EVENT, onOpenSchedule);
    return () => window.removeEventListener(SCHEDULE_UPDATE_REQUEST_EVENT, onOpenSchedule);
  }, []);

  // Open schedule view (bunny in chair) — pomodoro nav, post-it, deep links.
  useEffect(() => {
    const state = location.state as any;
    if (state?.openScheduleView && !state?.vibeCheckResult) {
      window.dispatchEvent(new CustomEvent(CALENDAR_SYNC_NOW_EVENT));
      // Prefer the most recent Google Calendar pull (today's events) so the
      // Pomodoro view reflects what's actually on the user's calendar now.
      (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            const timezone = getUserTimezone();
            const { data } = await supabase.functions.invoke("google-calendar", {
              body: { timezone, forceRefresh: true },
            });
            const events: Array<any> = data?.events || [];
            const todayLocal = localDateString(undefined, timezone);
            const todays = events
              .filter((e) => e.date === todayLocal && !e.isAllDay && e.startTime)
              .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
            if (todays.length > 0) {
              const schedule = todays.map((e, i) => ({
                id: e.id || `cal-${i}`,
                title: e.title || "Calendar Event",
                time: e.startTime,
                endTime: e.endTime,
                description: e.description || "",
                suit: DEFAULT_SCHEDULE_SUIT,
              }));
              setGeneratedSchedule(schedule);
              setViewMode("schedule");
              window.history.replaceState({}, document.title);
              return;
            }
          }
        } catch (err) {
          console.warn("Calendar cache unavailable, falling back to saved schedule", err);
        }

        // Fallback: last saved schedule.
        if (generatedSchedule.length === 0) {
          const snap = loadScheduleSnapshot();
          if (snap && snap.schedule.length > 0) {
            setGeneratedSchedule(snap.schedule);
            if (snap.settings) setSettings(snap.settings);
          } else {
            const result = await loadTodaySchedule();
            if (result && result.schedule.length > 0) {
              setGeneratedSchedule(result.schedule);
              if (result.settings) setSettings(result.settings);
            }
          }
        }
        setViewMode("schedule");
        window.history.replaceState({}, document.title);
      })();
    }
  }, [location.state]);

  useEffect(() => {
    if (authLoading) return;

    if (isGoogleCalendarOAuthReturn()) {
      sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
      sessionStorage.removeItem(AUTO_FETCH_CALENDAR_KEY);
      toast("Signed in! Fetching your calendar…", { icon: "📅" });
      setTimeout(() => {
        runCalendarAnalysis();
      }, 800);
      return;
    }

    if (sessionStorage.getItem(AUTO_FETCH_CALENDAR_KEY) === "1" && user) {
      sessionStorage.removeItem(AUTO_FETCH_CALENDAR_KEY);
      sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
      toast("Signed in! Fetching your calendar…", { icon: "📅" });
      setTimeout(() => {
        runCalendarAnalysis();
      }, 400);
      return;
    }

    if (sessionStorage.getItem(RESUME_CALENDAR_ANALYSIS_KEY) === "1") {
      sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
      setTimeout(() => {
        runCalendarAnalysis();
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Continue calendar analysis after the success confirmation page.
  useEffect(() => {
    const state = location.state as {
      calendarContinue?: boolean;
      events?: Array<Record<string, unknown>>;
      todayStr?: string;
    } | null;
    if (!state?.calendarContinue || !state?.events?.length) return;

    (async () => {
      setCalendarAnalyzing(true);
      const allEvents = state.events!;
      const todayStr = state.todayStr ?? localDateString();
      const weekEndStr = addDaysToDateString(todayStr, 7);

      const getEventDate = (ev: any): string | null => {
        const raw = ev?.date ?? ev?.startTime ?? ev?.start ?? null;
        return eventLocalDateString(raw);
      };

      const inRange = (ev: any, fromStr: string, toStr: string) => {
        const d = getEventDate(ev);
        return !!d && d >= fromStr && d <= toStr;
      };

      let scope: "today" | "week" | "month" = "today";
      let events = allEvents.filter((e: any) => inRange(e, todayStr, todayStr));
      if (events.length === 0) {
        events = allEvents.filter((e: any) => inRange(e, todayStr, weekEndStr));
        scope = "week";
      }
      if (events.length === 0) {
        events = allEvents;
        scope = "month";
      }

      const scopeLabel = scope === "today" ? "today" : scope === "week" ? "this week" : "this month";

      const { data: ana, error: anaErr } = await supabase.functions.invoke("analyze-calendar-tasks", {
        body: { events, today: todayStr },
      });
      if (anaErr || ana?.error) {
        toast.error(ana?.error || "Analysis failed");
      } else {
        const analyzed = ana?.analyzed ?? [];
        setAnalyzedTasks(analyzed);
        setImportedCalendarTasks(analyzed);
        if (analyzed.length > 0) {
          notifyUrgentNewTasks(importedCalendarTasks, analyzed, "calendar");
          await saveCalendarImport(analyzed);
        }
        toast.success(`Analyzed ${analyzed.length} events from ${scopeLabel} ✨`);
      }
      setCalendarAnalyzing(false);
      window.history.replaceState({}, document.title);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (!user) return;
    sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
    const redirectTo = sessionStorage.getItem(POST_GOOGLE_AUTH_REDIRECT_KEY);
    if (!redirectTo) return;
    sessionStorage.removeItem(POST_GOOGLE_AUTH_REDIRECT_KEY);
    const inWelcomeBackWizard = sessionStorage.getItem(WELCOME_BACK_WIZARD_KEY) === "1";
    navigate(redirectTo, {
      replace: true,
      state:
        redirectTo === "/welcome-back" && !inWelcomeBackWizard ? { forceLanding: true } : undefined,
    });
  }, [user, navigate]);

  const handleWizardComplete = (tasks: string, context?: ScheduleGenerationContext) => {
    sendMessage(tasks, {
      goals: formattedGoals,
      calendarAnalysis: context?.calendarAnalysis ?? importedCalendarTasks,
      vibeChecks: context?.vibeChecks,
      optimizeMode: context?.optimizeMode,
    });
    setViewMode("schedule");
  };

  const playBing = () => {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    // Layer multiple tones for a chime effect
    [1046, 1318, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const offset = i * 0.08;
      osc.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.2, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.6);
      osc.start(now + offset);
      osc.stop(now + offset + 0.6);
    });
  };

  const todayDate = useMemo(() => getFormattedDate(), []);

  const handleStart = async () => {
    playBing();

    let hasCalendar = hasSyncedCalendarToday(importedCalendarTasks);
    if (!hasCalendar && user) {
      const session = await loadTodaySchedule();
      hasCalendar = (session?.calendarImport?.length ?? 0) > 0;
      if (hasCalendar && session?.calendarImport) {
        setImportedCalendarTasks(session.calendarImport);
      }
    }

    if (hasCalendar) {
      sessionStorage.setItem(WELCOME_BACK_WIZARD_KEY, "1");
    } else {
      sessionStorage.removeItem(WELCOME_BACK_WIZARD_KEY);
    }
    navigate("/welcome-back", { state: hasCalendar ? { calendarAlreadySynced: true } : undefined });
  };
  const handleBackToLanding = () => {
    if (generatedSchedule.length === 0) setViewMode("landing");
  };

  const runCalendarAnalysis = async () => {
    if (calendarAnalyzing) return;
    setCalendarAnalyzing(true);
    let calendarConsentAttempted = false;

    const waitForAuthSession = async (timeoutMs = 6000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) return session;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return null;
    };

    const requestCalendarConsent = async (): Promise<string | null> => {
      if (calendarConsentAttempted) {
        toast.error(
          "Google sign-in finished, but Calendar access still is not available. Please check the app's Google Calendar setup before trying again.",
        );
        return null;
      }

      // Guard against an infinite redirect loop when Supabase never finishes
      // establishing a session after Google sign-in (bad_jwt / missing sub).
      if (sessionStorage.getItem(CALENDAR_OAUTH_ATTEMPT_KEY) === "1") {
        const settledSession = await waitForAuthSession();
        if (settledSession) {
          await persistGoogleTokens(settledSession);
          sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
          sessionStorage.removeItem(POST_GOOGLE_AUTH_REDIRECT_KEY);
          return settledSession.provider_token ?? null;
        }
        sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
        toast.error("Google sign-in didn't complete. Please try again.");
        return null;
      }

      toast("Opening Google Calendar permissions…", { icon: "🔐" });
      calendarConsentAttempted = true;
      sessionStorage.setItem(RESUME_CALENDAR_ANALYSIS_KEY, "1");
      sessionStorage.setItem(CALENDAR_OAUTH_ATTEMPT_KEY, "1");
      sessionStorage.setItem(POST_GOOGLE_AUTH_REDIRECT_KEY, "/");
      markAutoFetchCalendarAfterSignIn();

      // Always force consent — even when already signed in — so calendar
      // scopes and a refresh token are granted.
      const result = await requestGoogleCalendarAccessToken(true);

      if (result.error) {
        sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
        sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
        sessionStorage.removeItem(POST_GOOGLE_AUTH_REDIRECT_KEY);
        toast.error(result.error || "Could not start Google sign-in");
        return null;
      }

      if (result.redirected) return null;

      if (result.accessToken) {
        sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
        sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
      }
      sessionStorage.removeItem(POST_GOOGLE_AUTH_REDIRECT_KEY);
      return result.accessToken;
    };

    try {
      // Check existing session. The backend can use saved refresh tokens even
      // when the current session no longer has a provider_token.
      let {
        data: { session },
      } = await supabase.auth.getSession();
      await persistGoogleTokens(session);

      // Got a session: clear the redirect-attempt guard so future re-auths work.
      if (session) sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);

      if (!session) {
        await requestCalendarConsent();
        const resumedSession = await waitForAuthSession();
        if (!resumedSession) return;
        session = resumedSession;
        await persistGoogleTokens(session);
        sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
      }

      // Scan full month (31-day horizon).
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 31);

      toast("Scanning the next 31 days of your calendar…", { icon: "🔍" });

      const fetchCalendar = async (calendarAccessToken?: string | null) => {
        const headers: Record<string, string> = {};
        if (calendarAccessToken) headers["x-provider-token"] = calendarAccessToken;
        return supabase.functions.invoke("google-calendar", {
          headers,
          body: {
            timezone: getUserTimezone(),
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
          },
        });
      };

      let { data: calData, error: calErr } = await fetchCalendar();
      if (calData?.needsAuth) {
        if (calData?.events?.length) {
          toast("Using your saved calendar while refreshing permissions…", { icon: "📅" });
        } else {
          toast("Calendar permission needs to be refreshed.", { icon: "📅" });
        }
        const accessToken = await requestCalendarConsent();
        ({ data: calData, error: calErr } = await fetchCalendar(accessToken));
        if (calData?.needsAuth) {
          toast.error("Calendar access unavailable. Please sign in again.");
          return;
        }
      }
      if (calErr || calData?.error) {
        toast.error(calData?.error || "Failed to fetch calendar");
        setCalendarAnalyzing(false);
        return;
      }
      const allEvents = calData?.events ?? [];

      if (allEvents.length === 0) {
        toast.error("No upcoming events found in the next 31 days.");
        setCalendarAnalyzing(false);
        return;
      }

      setCalendarAnalyzing(false);
      const successState = {
        eventCount: allEvents.length,
        scopeLabel: "the next 31 days",
        returnTo: "/",
        events: allEvents,
        todayStr: localDateString(),
      };
      saveCalendarSuccessState(successState);
      navigate("/calendar-success", { state: successState });
    } catch (e) {
      console.error(e);
      toast.error("Could not analyze calendar");
    } finally {
      setCalendarAnalyzing(false);
    }
  };

  const monthlyCalendarModal = (
    <MonthlyCalendarModal
      isOpen={showMonthlyCalendar}
      onClose={() => setShowMonthlyCalendar(false)}
      calendarTasks={importedCalendarTasks}
      goals={goals}
      schedule={generatedSchedule}
      isSignedIn={!!user}
      onCalendarTasksUpdated={setImportedCalendarTasks}
      saveCalendarImport={saveCalendarImport}
      onConnectCalendar={runCalendarAnalysis}
    />
  );

  // ─── LANDING PAGE ───
  if (viewMode === "landing") {
    return (
      <>
      <div className="min-h-screen relative overflow-hidden" style={{ background: "hsl(300 50% 88%)" }}>
        <SEO
          title="TimeBunny — AI Schedule Builder & Atomic Habits Companion"
          description="Build a focused daily plan from your calendar, energy, and long-term goals with a kawaii bunny mascot and built-in Pomodoro timer."
          path="/"
        />

        {/* Clock outline background - FULL PAGE */}
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
            {/* Hour marks - 12, 3, 6, 9 - visible portions */}
            <div
              className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[16px] h-[60px] rounded-full"
              style={{ background: "hsl(90 80% 45%)" }}
            />
            <div
              className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[16px] h-[60px] rounded-full"
              style={{ background: "hsl(90 80% 45%)" }}
            />
            <div
              className="absolute left-[2%] top-1/2 -translate-y-1/2 w-[60px] h-[16px] rounded-full"
              style={{ background: "hsl(90 80% 45%)" }}
            />
            <div
              className="absolute right-[2%] top-1/2 -translate-y-1/2 w-[60px] h-[16px] rounded-full"
              style={{ background: "hsl(90 80% 45%)" }}
            />
            {/* Clock hands - visible portion */}
            <div
              className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[10px] h-[30%] rounded-full origin-bottom rotate-[30deg]"
              style={{ background: "hsl(90 80% 45% / 0.7)" }}
            />
            <div
              className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[8px] h-[35%] rounded-full origin-bottom rotate-[-60deg]"
              style={{ background: "hsl(90 80% 45% / 0.7)" }}
            />
            {/* Center dot */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full"
              style={{ background: "hsl(90 80% 45%)" }}
            />
          </div>
        </div>

        {/* Clock tick marks in circular pattern */}
        <div className="absolute inset-0 pointer-events-none z-[1] flex items-center justify-center">
          <div className="relative" style={{ width: "min(150vw, 150vh)", height: "min(150vw, 150vh)" }}>
            {Array.from({ length: 60 }).map((_, i) => {
              const isHour = i % 5 === 0;
              const angle = i * 6;
              return (
                <div
                  key={i}
                  className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom"
                  style={{
                    height: "50%",
                    transform: `translateX(-50%) rotate(${angle}deg)`,
                  }}
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

        {/* Content - positioned above and below clock */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4">
            <div className="flex items-center gap-2">
              <Link to="/auth">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-[hsl(280_40%_40%)] hover:text-[hsl(280_40%_30%)] glass-pill rounded-full px-4"
                >
                  <span className="font-body font-semibold">New user?</span>
                </Button>
              </Link>
            </div>
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-2 text-[hsl(280_40%_40%)] hover:text-[hsl(280_40%_30%)]"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            ) : (
              <Link to="/auth">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-[hsl(280_40%_40%)] hover:text-[hsl(280_40%_30%)] glass-pill rounded-full px-4"
                >
                  <span className="font-body font-semibold">Sign In / Sign Up</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Title and Start button - centered */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center">
              <h1
                className="pixel-title text-6xl sm:text-7xl md:text-8xl lg:text-[8rem] leading-none tracking-[0.15em]"
                style={{ color: "hsl(280 50% 65%)" }}
              >
                TIME
              </h1>
              <h1
                className="pixel-title text-6xl sm:text-7xl md:text-8xl lg:text-[8rem] leading-none mt-4 sm:mt-6 md:mt-8 tracking-[0.15em] ml-4 sm:ml-8 md:ml-12"
                style={{ color: "hsl(185 70% 60%)" }}
              >
                BUNNY
              </h1>
            </div>

            <button
              onClick={handleStart}
              className="glass-pill px-12 sm:px-16 py-4 sm:py-5 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95 mt-4 sm:mt-6"
            >
              <span className="pixel-title-alt text-2xl sm:text-3xl" style={{ color: "hsl(330 80% 55%)" }}>
                start
              </span>
            </button>
          </div>

          {/* Nav links - at the bottom of the page */}
          <div className="flex flex-wrap items-center justify-center gap-8 pb-8 sm:pb-12 mt-6 px-4 sm:px-8 max-w-2xl mx-auto">
            <Link
              to="/goals"
              className="flex items-center gap-2 px-7 py-3.5 rounded-full glass-pill text-lg transition-all hover:scale-105"
              style={{ color: "hsl(280 40% 40%)" }}
            >
              <Target className="w-6 h-6" />
              <span className="font-body font-semibold">Goals</span>
              <span>🎯</span>
            </Link>
            <button
              onClick={() => setShowMonthlyCalendar(true)}
              className="flex items-center gap-2 px-7 py-3.5 rounded-full glass-pill text-lg transition-all hover:scale-105"
              style={{ color: "hsl(280 40% 40%)" }}
              aria-label="Open monthly calendar"
              title={`My calendar • ${todayDate}`}
            >
              <Calendar className="w-6 h-6" />
              <span className="font-body font-semibold">My Calendar</span>
              <span>📅</span>
            </button>
          </div>
        </div>

        <LandingBunnySpeech
          comfortMode={comfortMode}
          autoShow={comfortMode === "critical_only"}
        />

        <CalendarAnalysisModal
          isOpen={analyzedTasks !== null}
          onClose={() => setAnalyzedTasks(null)}
          onSave={async (tasks) => {
            await saveCalendarImport(tasks);
            setImportedCalendarTasks(tasks);
            toast.success("Calendar import saved!");
          }}
          onNext={() => {
            playBing();
            setViewMode("wizard");
          }}
          tasks={analyzedTasks ?? []}
          monthLabel={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        />
      </div>
      {monthlyCalendarModal}
      </>
    );
  }

  // ─── APP VIEW ───
  return (
    <>
      <SEO
        title="Build Your Schedule — TimeBunny"
        description="Walk through the TimeBunny wizard to capture energy, stress, and tasks, then generate today's focused schedule."
        path="/"
      />
      <WizardInterface
        settings={settings}
        onSettingsChange={setSettings}
        onComplete={handleWizardComplete}
        isLoading={isLoading}
        generatedSchedule={generatedSchedule}
        analyzedCalendarTasks={importedCalendarTasks}
        comfortMode={comfortMode}
        onComfortDismiss={() => setComfortMode(null)}
        initialScene={viewMode === "schedule" ? "schedule" : "cozy"}
        onScheduleChange={(items) => setGeneratedSchedule(items)}
        onUpdateSchedule={() => {
          setViewMode("wizard");
        }}
      />
      {monthlyCalendarModal}
    </>
  );
};

export default Index;
