import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import WelcomeBack from "./pages/WelcomeBack";
import Goals from "./pages/Goals";
import Badges from "./pages/Badges";
import Moodboard from "./pages/Moodboard";
import VibeCheck from "./pages/VibeCheck";
import CalendarSuccess from "./pages/CalendarSuccess";
import NotFound from "./pages/NotFound";
import AppNavigation from "./components/AppNavigation";
import { LocalTimeProvider } from "@/hooks/useLocalTime";
import { usePlatform } from "@/hooks/usePlatform";
import { supabase } from "@/integrations/supabase/client";
import "@/lib/googleCalendarAccess";

const queryClient = new QueryClient();

const ConditionalNav = () => <AppNavigation />;

/** Routes OAuth / custom-scheme deep links back into the SPA on native. */
const NativeDeepLinkRouter = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: Event) => {
      const url = (event as CustomEvent<{ url: string }>).detail?.url;
      if (!url) return;
      try {
        const parsed = new URL(url);
        const path = parsed.pathname + parsed.search + parsed.hash;
        if (path && path !== "/") navigate(path);
      } catch {
        /* ignore malformed URLs */
      }
    };
    window.addEventListener("timebunny:app-url-open", handler);
    return () => window.removeEventListener("timebunny:app-url-open", handler);
  }, [navigate]);

  return null;
};

const MobileAppShell = ({ children }: { children: ReactNode }) => {
  const { useMobileChrome } = usePlatform();
  return (
    <div className={useMobileChrome ? "mobile-app-shell min-h-screen" : "min-h-screen"}>
      {children}
    </div>
  );
};

const TokenCapture = () => {
  useEffect(() => {
    const saveTokens = async (session: any) => {
      if (!session) return;
      const refreshToken = session.provider_refresh_token;
      const accessToken = session.provider_token;
      if (refreshToken || accessToken) {
        await supabase.functions.invoke("google-token-save", {
          body: {
            refresh_token: refreshToken ?? null,
            access_token: accessToken ?? null,
            expires_in: 3600,
            scope:
              "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly",
          },
        });
      }
    };

    // Capture tokens from existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      saveTokens(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        await saveTokens(session);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LocalTimeProvider>
        <MobileAppShell>
        <TokenCapture />
        <NativeDeepLinkRouter />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/welcome-back" element={<WelcomeBack />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/badges" element={<Badges />} />
          <Route path="/moodboard" element={<Moodboard />} />
          <Route path="/vibe-check" element={<VibeCheck />} />
          <Route path="/pomodoro" element={<Navigate to="/" replace state={{ openScheduleView: true }} />} />
          <Route path="/calendar-success" element={<CalendarSuccess />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ConditionalNav />
        </MobileAppShell>
        </LocalTimeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
