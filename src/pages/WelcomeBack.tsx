import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, LogOut } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import WizardInterface from "@/components/WizardInterface";
import CalendarAnalysisModal, { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useGoals } from "@/hooks/useGoals";
import { formatGoalsForSchedule } from "@/lib/goalsSchedule";
import { useGoalScheduleSync } from "@/hooks/useGoalScheduleSync";
import type { ScheduleGenerationContext } from "@/lib/scheduleOptimizationContext";
import { hasSyncedCalendarToday, useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { SCHEDULE_UPDATE_REQUEST_EVENT } from "@/lib/scheduleUpdateNotice";
import { CALENDAR_SYNCED_EVENT } from "@/lib/calendarSync";
import { setCalendarSyncPaused } from "@/lib/calendarSyncPause";
import { notifyUrgentNewTasks } from "@/lib/urgentScheduleItems";
import { UserSettings } from "@/types/schedule";
import { supabase } from "@/integrations/supabase/client";
import { connectGoogleCalendar } from "@/lib/googleCalendarAccess";
import { saveCalendarSuccessState } from "@/pages/CalendarSuccess";
import {
  AUTO_FETCH_CALENDAR_KEY,
  isGoogleCalendarOAuthReturn,
  isOAuthReturn,
  markAutoFetchCalendarAfterSignIn,
} from "@/lib/googleOAuthReturn";

import bunnyMascot from "@/assets/bunny-mascot.png";
import LandingBunnySpeech from "@/components/LandingBunnySpeech";
import { getUserTimezone, localDateString } from "@/lib/localTime";

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

type View = "landing" | "wizard" | "schedule";
const RESUME_CALENDAR_ANALYSIS_KEY = "resume_calendar_analysis_wb";
const CALENDAR_OAUTH_ATTEMPT_KEY = "calendar_oauth_attempt";
const POST_GOOGLE_AUTH_REDIRECT_KEY = "timebunny_post_google_auth_redirect";
const WIZARD_VIEW_KEY = "timebunny_welcome_back_wizard";

const readStoredView = (): View => {
  if (sessionStorage.getItem(WIZARD_VIEW_KEY) === "1") return "wizard";
  return "landing";
};

const WelcomeBack = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [view, setView] = useState<View>(readStoredView);
  const viewRef = useRef(view);
  const forceLandingHandledRef = useRef(false);
  const calendarSyncedNoteShownRef = useRef(false);
  const [calendarAnalyzing, setCalendarAnalyzing] = useState(false);
  const [analyzedTasks, setAnalyzedTasks] = useState<AnalyzedTask[] | null>(null);
  const [importedCalendarTasks, setImportedCalendarTasks] = useState<AnalyzedTask[]>(() => {
    try {
      const raw = localStorage.getItem(`timebunny:session:${localDateString()}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { calendarImport?: AnalyzedTask[] };
      return parsed.calendarImport ?? [];
    } catch {
      return [];
    }
  });
  const [calendarImported, setCalendarImported] = useState(() => hasSyncedCalendarToday());
  const [calendarSyncedNoteVisible, setCalendarSyncedNoteVisible] = useState(false);
  const [scope, setScope] = useState<"day" | "week" | "month">("month");
  const [showProviderChoice, setShowProviderChoice] = useState(false);


  const handleAppleSignIn = async () => {
    setShowProviderChoice(false);
    toast("Opening Apple sign-in…", { icon: "" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/welcome-back` },
    });
    if (error) toast.error(error.message || "Could not start Apple sign-in");
    else toast("Apple doesn't share calendar events — you can Skip to continue.", { icon: "ℹ️", duration: 6000 });
  };

  const handleGoogleChoice = () => {
    setShowProviderChoice(false);
    runCalendarAnalysis(scope);
  };

  const { isLoading, sendMessage, generatedSchedule, setGeneratedSchedule } = useChat(settings);
  const { goals } = useGoals();
  const formattedGoals = useMemo(() => formatGoalsForSchedule(goals), [goals]);
  const { saveSchedule, saveCalendarImport, loadTodaySchedule } = useSchedulePersistence(user?.id);

  useEffect(() => {
    loadTodaySchedule().then((session) => {
      if (session?.calendarImport?.length) {
        setImportedCalendarTasks(session.calendarImport);
        setCalendarImported(true);
      }
    });
  }, [user, loadTodaySchedule]);

  useEffect(() => {
    setCalendarSyncPaused(calendarAnalyzing);
  }, [calendarAnalyzing]);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ tasks?: AnalyzedTask[] }>).detail;
      if (!detail?.tasks) return;
      setImportedCalendarTasks(detail.tasks);
      if (detail.tasks.length > 0) setCalendarImported(true);
    };
    window.addEventListener(CALENDAR_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(CALENDAR_SYNCED_EVENT, onSynced);
  }, []);

  useGoalScheduleSync(generatedSchedule, goals, settings, setGeneratedSchedule, generatedSchedule.length > 0);

  useEffect(() => {
    const onOpenSchedule = () => {
      setView("schedule");
    };
    window.addEventListener(SCHEDULE_UPDATE_REQUEST_EVENT, onOpenSchedule);
    return () => window.removeEventListener(SCHEDULE_UPDATE_REQUEST_EVENT, onOpenSchedule);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Brief side note when Start skipped welcome-back because calendar was already synced.
  useEffect(() => {
    if (view !== "wizard" || calendarSyncedNoteShownRef.current) return;

    const synced = (location.state as { calendarAlreadySynced?: boolean } | null)?.calendarAlreadySynced;
    if (!synced) return;

    calendarSyncedNoteShownRef.current = true;
    setCalendarSyncedNoteVisible(true);
    window.history.replaceState({}, document.title);

    const timer = window.setTimeout(() => setCalendarSyncedNoteVisible(false), 10000);
    return () => window.clearTimeout(timer);
  }, [view]);

  const goToWizard = useCallback(() => {
    sessionStorage.setItem(WIZARD_VIEW_KEY, "1");
    setView("wizard");
  }, []);

  const goToLanding = useCallback(() => {
    sessionStorage.removeItem(WIZARD_VIEW_KEY);
    setView("landing");
  }, []);

  // Auth returns with forceLanding should show Welcome Back once — never yank users out of the wizard.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const state = location.state as {
      forceLanding?: boolean;
      calendarContinue?: boolean;
      events?: Array<Record<string, unknown>>;
      todayStr?: string;
      scopeLabel?: string;
    } | null;
    const forceLanding = params.get("landing") === "1" || state?.forceLanding;
    if (!forceLanding || forceLandingHandledRef.current || viewRef.current === "wizard") return;

    forceLandingHandledRef.current = true;
    goToLanding();

    const nextState = state?.calendarContinue
      ? {
          calendarContinue: state.calendarContinue,
          events: state.events,
          todayStr: state.todayStr,
          scopeLabel: state.scopeLabel,
        }
      : {};
    navigate("/welcome-back", { replace: true, state: nextState });
  }, [location.search, location.state, navigate, goToLanding]);

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

  // Save schedule once generated; user reviews it then taps Start Focus Timer.
  useEffect(() => {
    if (generatedSchedule.length > 0) {
      saveSchedule(generatedSchedule, settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedSchedule]);

  // After Google sign-in, auto-fetch calendar then show the success confirmation page.
  useEffect(() => {
    if (authLoading) return;
    if (viewRef.current === "wizard") return;

    const autoScan = (location.state as any)?.autoScan === true;

    if (isGoogleCalendarOAuthReturn()) {
      sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
      sessionStorage.removeItem(AUTO_FETCH_CALENDAR_KEY);
      sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
      sessionStorage.removeItem(POST_GOOGLE_AUTH_REDIRECT_KEY);
      toast("Signed in! Fetching your calendar…", { icon: "📅" });
      setTimeout(() => {
        runCalendarAnalysis(scope);
      }, 800);
      return;
    }

    // Hash may already be consumed by Supabase before this effect runs.
    if (sessionStorage.getItem(AUTO_FETCH_CALENDAR_KEY) === "1" && user) {
      sessionStorage.removeItem(AUTO_FETCH_CALENDAR_KEY);
      sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
      toast("Signed in! Fetching your calendar…", { icon: "📅" });
      setTimeout(() => {
        runCalendarAnalysis(scope);
      }, 400);
      return;
    }

    if (autoScan) {
      window.history.replaceState({}, document.title, "/welcome-back");
      setTimeout(() => {
        runCalendarAnalysis(scope);
      }, 200);
    } else if (!isOAuthReturn()) {
      sessionStorage.removeItem(RESUME_CALENDAR_ANALYSIS_KEY);
      sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
      sessionStorage.removeItem(POST_GOOGLE_AUTH_REDIRECT_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (user) sessionStorage.removeItem(CALENDAR_OAUTH_ATTEMPT_KEY);
  }, [user]);

  // Continue calendar analysis after the success confirmation page.
  useEffect(() => {
    const state = location.state as {
      calendarContinue?: boolean;
      events?: Array<Record<string, unknown>>;
      todayStr?: string;
    } | null;
    if (!state?.calendarContinue || !state?.events?.length) return;

    sessionStorage.removeItem(WIZARD_VIEW_KEY);
    goToLanding();

    (async () => {
      setCalendarAnalyzing(true);
      const events = state.events!;
      const todayStr = state.todayStr ?? localDateString();

      const { data: ana, error: anaErr } = await supabase.functions.invoke("analyze-calendar-tasks", {
        body: { events, today: todayStr },
      });
      if (anaErr || ana?.error) {
        toast.error(ana?.error || "Analysis failed");
      } else {
        const analyzed = ana?.analyzed ?? [];
        setAnalyzedTasks(analyzed);
        setImportedCalendarTasks(analyzed);
        setCalendarImported(true);
        if (analyzed.length > 0) {
          notifyUrgentNewTasks(importedCalendarTasks, analyzed, "calendar");
          await saveCalendarImport(analyzed);
        }
        toast.success(`Analyzed ${analyzed.length} events ✨`);
      }
      setCalendarAnalyzing(false);
      window.history.replaceState({}, document.title);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, goToLanding]);

  const runCalendarAnalysis = async (chosenScope: "day" | "week" | "month" = scope) => {
    if (calendarAnalyzing) return;
    if (viewRef.current === "wizard") return;
    setCalendarAnalyzing(true);
    let calendarConsentAttempted = false;
    // Watchdog: never let the spinner hang forever.
    const watchdog = window.setTimeout(() => {
      console.warn("[calendar] watchdog timeout — releasing spinner");
      setCalendarAnalyzing(false);
      toast.error("Calendar scan timed out. Tap My Calendar to try again or Skip to continue.");
    }, 30000);

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

      // Guard: if we already attempted a Google redirect once and still have
      // no session, don't bounce the user into another redirect (infinite loop).
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
      sessionStorage.setItem(POST_GOOGLE_AUTH_REDIRECT_KEY, "/welcome-back");
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

      const scopeOrder: Array<"day" | "week" | "month"> = ["day", "week", "month"];
      const startIdx = scopeOrder.indexOf(chosenScope);
      const tryOrder = scopeOrder.slice(startIdx);

      const fetchCalendar = async (scopeKey: "day" | "week" | "month", calendarAccessToken?: string | null) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        const scopeDays = scopeKey === "day" ? 1 : scopeKey === "week" ? 7 : 31;
        end.setDate(end.getDate() + scopeDays);

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

      let events: any[] = [];
      let calData: any = null;
      let calErr: any = null;
      let usedScope: "day" | "week" | "month" = chosenScope;

      for (const scopeKey of tryOrder) {
        const label = scopeKey === "day" ? "today" : scopeKey === "week" ? "this week" : "the next 31 days";
        toast(`Scanning ${label} of your calendar…`, { icon: "🔍" });

        let res = await fetchCalendar(scopeKey);
        if (res.data?.needsAuth) {
          if (res.data?.events?.length) {
            toast("Using your saved calendar while refreshing permissions…", { icon: "📅" });
          } else {
            toast("Calendar permission needs to be refreshed.", { icon: "📅" });
          }
          const accessToken = await requestCalendarConsent();
          res = await fetchCalendar(scopeKey, accessToken);
          if (res.data?.needsAuth) {
            toast.error("Calendar access unavailable. Please sign in again.");
            setCalendarAnalyzing(false);
            window.clearTimeout(watchdog);
            return;
          }
        }

        calData = res.data;
        calErr = res.error;
        if (calErr || calData?.error) {
          toast.error(calData?.error || "Failed to fetch calendar");
          setCalendarAnalyzing(false);
          window.clearTimeout(watchdog);
          return;
        }

        const fetched = calData?.events ?? [];
        const diag = calData?.diagnostics;
        console.log(`[calendar] scope=${scopeKey} fetched ${fetched.length} events`, diag);
        if (fetched.length > 0) {
          events = fetched;
          usedScope = scopeKey;
          if (scopeKey !== chosenScope) {
            toast(`No events in ${chosenScope === "day" ? "today" : "this week"} — widened to ${label}`, {
              icon: "🔭",
            });
          }
          break;
        }
      }

      const todayStr = localDateString();

      if (events.length === 0) {
        const diag = calData?.diagnostics;
        const breakdown = diag?.perCalendar
          ?.map((c: any) => `${c.summary}: ${c.rawCount}${c.error ? ` (${c.error})` : ""}`)
          .join(" • ");
        if (breakdown) {
          toast.error(`No upcoming events in next 31 days. Calendars scanned — ${breakdown}`, { duration: 9000 });
        } else {
          toast.error(
            "Still no upcoming events found across the next 31 days. Double-check the Google account you signed in with has events on its calendar.",
          );
        }
        setAnalyzedTasks([]);
        setCalendarImported(true);
        return;
      }

      const scopeLabel =
        usedScope === "day" ? "today" : usedScope === "week" ? "this week" : "the next 31 days";

      window.clearTimeout(watchdog);
      setCalendarAnalyzing(false);
      const successState = {
        eventCount: events.length,
        scopeLabel,
        returnTo: "/welcome-back",
        events,
        todayStr,
      };
      saveCalendarSuccessState(successState);
      navigate("/calendar-success", { state: successState });
    } catch (e) {
      console.error(e);
      toast.error("Could not analyze calendar");
    } finally {
      window.clearTimeout(watchdog);
      setCalendarAnalyzing(false);
    }
  };

  const handleWizardComplete = (tasks: string, context?: ScheduleGenerationContext) => {
    sendMessage(tasks, {
      goals: formattedGoals,
      calendarAnalysis: context?.calendarAnalysis ?? importedCalendarTasks,
      vibeChecks: context?.vibeChecks,
      optimizeMode: context?.optimizeMode,
      existingSchedule: context?.existingSchedule ?? generatedSchedule,
      journalText: context?.journalText,
    });
    goToWizard();
  };

  // ─── WIZARD VIEW (starts at cozy) ───
  if (view === "wizard") {
    return (
      <>
        <SEO
          title="Welcome Back — TimeBunny"
          description="Pick up where you left off: journal, energy, stress, focus."
          path="/welcome-back"
        />
        <WizardInterface
          settings={settings}
          onSettingsChange={setSettings}
          onComplete={handleWizardComplete}
          isLoading={isLoading}
          generatedSchedule={generatedSchedule}
          analyzedCalendarTasks={importedCalendarTasks}
          initialScene="cozy"
          onBackFromInitial={goToLanding}
          onScheduleChange={(items) => setGeneratedSchedule(items)}
          requireJournal={!calendarImported}
        />
        {calendarSyncedNoteVisible && (
          <aside
            className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-[70] max-w-[13rem] sm:max-w-[15rem] px-4 py-3 rounded-2xl border-2 shadow-lg pointer-events-none transition-opacity duration-500"
            style={{
              background: "hsl(300 60% 96%)",
              borderColor: "hsl(140 45% 55%)",
              boxShadow: "4px 4px 0 hsl(140 45% 40%)",
              fontFamily: "var(--font-body)",
            }}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold" style={{ color: "hsl(140 50% 30%)" }}>
              ✓ Calendar already synced
            </p>
            <p className="text-xs mt-1 leading-snug" style={{ color: "hsl(280 30% 40%)" }}>
              Skipped straight to your journal — your events are ready.
            </p>
          </aside>
        )}
      </>
    );
  }

  // ─── LANDING (returning user) ───
  return (
    <>
    <div className="min-h-screen relative overflow-hidden" style={{ background: "hsl(300 50% 88%)" }}>
      <SEO
        title="Welcome Back — TimeBunny"
        description="Returning? Sync your calendar, journal, and jump straight to your focus timer."
        path="/welcome-back"
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 pt-12 sm:pt-14 pb-4">
        <Link
          to="/"
          state={{ fromLibraryBack: true }}
          className="text-sm font-body font-semibold"
          style={{ color: "hsl(280 40% 40%)" }}
        >
          ← Back
        </Link>
        {user ? (
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-[hsl(280_40%_40%)]">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        ) : (
          <Link to="/auth?returnTo=/welcome-back">
            <Button variant="ghost" size="sm" className="gap-2 text-[hsl(280_40%_40%)] glass-pill rounded-full px-4">
              <span className="font-body font-semibold">Sign In</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-8 pb-24 text-center">
        <h1
          className="pixel-title text-5xl sm:text-6xl md:text-7xl leading-none tracking-[0.15em]"
          style={{ color: "hsl(280 50% 65%)" }}
        >
          WELCOME
        </h1>
        <h1
          className="pixel-title text-5xl sm:text-6xl md:text-7xl leading-none mt-3 tracking-[0.15em]"
          style={{ color: "hsl(185 70% 60%)" }}
        >
          BACK
        </h1>
        <p className="mt-6 max-w-md font-body text-base sm:text-lg" style={{ color: "hsl(280 40% 35%)" }}>
          Sync your calendar, then we'll jump straight into journaling and a fresh focus session.
        </p>

        {/* Scope selector */}
        <div
          className="mt-8 flex items-center gap-2 glass-pill rounded-full p-1"
          role="group"
          aria-label="Calendar scope"
        >
          {(["day", "week", "month"] as const).map((s) => {
            const active = scope === s;
            return (
              <button
                key={s}
                onClick={() => setScope(s)}
                className="px-4 py-1.5 rounded-full text-sm font-body font-semibold capitalize transition-all"
                style={{
                  background: active ? "hsl(280 60% 60%)" : "transparent",
                  color: active ? "white" : "hsl(280 40% 40%)",
                }}
                aria-pressed={active}
              >
                {s}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowProviderChoice(true)}
          disabled={calendarAnalyzing}
          className="mt-6 flex items-center gap-3 px-8 py-4 rounded-full glass-pill text-lg transition-all hover:scale-105 disabled:opacity-60"
          style={{ color: "hsl(280 40% 40%)" }}
          aria-label="Sync my calendar"
        >
          <Calendar className="w-6 h-6" />
          <span className="font-body font-semibold">
            {calendarAnalyzing ? "Analyzing…" : calendarImported ? "Re-sync Calendar" : "My Calendar"}
          </span>
          <span>📅</span>
        </button>

        {calendarImported && (
          <p className="mt-4 text-sm font-body max-w-md text-center" style={{ color: "hsl(140 50% 35%)" }}>
            ✓ Calendar synced — TimeBunny checks for new events automatically while you use the app
          </p>
        )}

        {!calendarImported && !calendarAnalyzing && (
          <button
            onClick={() => {
              setCalendarAnalyzing(false);
              goToWizard();
            }}
            className="fixed bottom-4 right-4 z-50 flex items-center justify-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{ background: "hsl(280 70% 50%)" }}
            aria-label="Continue without syncing calendar"
          >
            <span>Next</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}

      </div>

      {/* Syncing overlay — visible while calendar fetch runs after Google sign-in */}
      {calendarAnalyzing && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6 text-center bg-[#fdf4ff]/95">
          <div
            aria-hidden
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#ddd6fe 1px, transparent 1px), linear-gradient(90deg, #ddd6fe 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative z-10 bg-white border-2 border-[#5b21b6] shadow-[6px_6px_0px_#a78bfa] px-8 py-8 max-w-sm w-full">
            <img
              src={bunnyMascot}
              alt=""
              aria-hidden
              className="w-24 mx-auto object-contain drop-shadow-[3px_3px_0px_#a78bfa] pixel-img mb-5 animate-pulse"
              draggable={false}
            />
            <p className="text-[#5b21b6] text-[11px] leading-relaxed tracking-wide" style={{ fontFamily: "'Press Start 2P', cursive" }}>
              FETCHING CALENDAR…
            </p>
            <p className="mt-3 text-[#a78bfa] text-xl leading-snug" style={{ fontFamily: "'VT323', monospace" }}>
              TimeBunny is pulling your upcoming events from Google Calendar.
            </p>
          </div>
        </div>
      )}

    </div>

      <LandingBunnySpeech placement="flush-right" />

      {/* Next button — fixed bottom-right, after calendar sync or to continue without */}
      {calendarImported && !calendarAnalyzing && (
        <button
          onClick={goToWizard}
          className="fixed bottom-4 right-4 z-50 flex items-center justify-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: "hsl(280 70% 50%)" }}
          aria-label="Continue to journal"
        >
          <span>Next</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      )}

      <CalendarAnalysisModal
        isOpen={analyzedTasks !== null}
        onClose={() => setAnalyzedTasks(null)}
        onSave={async (tasks) => {
          await saveCalendarImport(tasks);
          setImportedCalendarTasks(tasks);
          setCalendarImported(true);
          toast.success("Calendar import saved!");
        }}
        onNext={() => {
          setAnalyzedTasks(null);
          setCalendarImported(true);
          goToWizard();
        }}
        tasks={analyzedTasks ?? []}
        monthLabel={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      />

      {/* Provider chooser modal */}
      {showProviderChoice && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: "rgba(30, 10, 40, 0.55)" }}
          onClick={() => setShowProviderChoice(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{
              background: "hsl(300 60% 96%)",
              border: "3px solid hsl(280 50% 55%)",
              boxShadow: "6px 6px 0 hsl(280 50% 40%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="pixel-title text-xl tracking-wider mb-2"
              style={{ color: "hsl(280 50% 45%)" }}
            >
              CONNECT CALENDAR
            </h2>
            <p className="font-body text-sm mb-5" style={{ color: "hsl(280 40% 35%)" }}>
              Choose how you'd like to sign in.
            </p>

            <button
              onClick={handleGoogleChoice}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full mb-3 font-body font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: "white",
                color: "hsl(280 40% 25%)",
                border: "2px solid hsl(280 40% 60%)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>

            <button
              onClick={handleAppleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full mb-4 font-body font-semibold transition-all hover:scale-[1.02]"
              style={{ background: "black", color: "white" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.42 2.23-1.25 3.02-.83.83-2.2 1.47-3.32 1.38-.14-1.12.41-2.29 1.2-3.05.83-.82 2.26-1.44 3.37-1.35zM20.5 17.28c-.55 1.28-.82 1.85-1.53 2.98-.99 1.57-2.39 3.52-4.12 3.54-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.79-4.04-3.36C.03 16.24-.28 10.98 1.94 8.19c1.58-1.99 4.06-3.15 6.4-3.15 2.38 0 3.88 1.3 5.85 1.3 1.91 0 3.08-1.3 5.82-1.3 2.08 0 4.29 1.13 5.86 3.08-5.15 2.82-4.32 10.16-.37 12.16z"/>
              </svg>
              Continue with Apple
            </button>

            <button
              onClick={() => setShowProviderChoice(false)}
              className="text-sm font-body underline"
              style={{ color: "hsl(280 40% 40%)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default WelcomeBack;
