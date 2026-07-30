import { supabase } from "@/integrations/supabase/client";

type GoogleCalendarConnectionResult = {
  accessToken: string | null;
  error?: string;
  redirected?: boolean;
};

export const GOOGLE_CALENDAR_SCOPES =
  "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly";

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

/** Return the user to the same page after Google OAuth completes. */
export const getGoogleOAuthRedirectTo = () =>
  `${window.location.origin}${window.location.pathname}${window.location.search}`;

export const persistGoogleTokens = async (session: any) => {
  if (!session?.provider_refresh_token && !session?.provider_token) return;
  await supabase.functions.invoke("google-token-save", {
    body: {
      refresh_token: session.provider_refresh_token || null,
      access_token: session.provider_token || null,
      expires_in: 3600,
      scope:
        "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly",
    },
  });
};

/**
 * Obtain Google Calendar access via Supabase OAuth (not Lovable's /~oauth broker,
 * which 404s outside Lovable-hosted domains). When forceConsent is true, always
 * re-prompt so calendar scopes + a refresh token are granted.
 */
export const connectGoogleCalendar = async (
  opts?: { forceConsent?: boolean },
): Promise<GoogleCalendarConnectionResult> => {
  const forceConsent = opts?.forceConsent ?? false;

  const {
    data: { session: existingSession },
  } = await supabase.auth.getSession();

  if (existingSession?.provider_token && !forceConsent) {
    await persistGoogleTokens(existingSession);
    return { accessToken: existingSession.provider_token };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: GOOGLE_CALENDAR_SCOPES,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
      redirectTo: getGoogleOAuthRedirectTo(),
    },
  });

  if (error) return { accessToken: null, error: error.message };

  // Supabase OAuth redirects the browser; the caller resumes after redirect.
  return { accessToken: null, redirected: true };
};

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && (session?.provider_refresh_token || session?.provider_token)) {
    await persistGoogleTokens(session);
  }
});

export const fetchCalendarEvents = async (timezone: string, opts?: { forceRefresh?: boolean }) => {
  const { data: cachedData } = await supabase.functions.invoke("google-calendar", {
    body: { timezone, cacheOnly: true },
  });

  const fetchedAt = cachedData?.fetchedAt ? new Date(cachedData.fetchedAt) : null;
  const ageMinutes = fetchedAt ? (Date.now() - fetchedAt.getTime()) / 60000 : 999;

  if (cachedData?.events?.length && ageMinutes < 20 && !opts?.forceRefresh) {
    return cachedData.events;
  }

  const invokeLive = async (accessToken?: string | null) => {
    const headers: Record<string, string> = {};
    if (accessToken) headers["x-provider-token"] = accessToken;
    return supabase.functions.invoke("google-calendar", {
      headers,
      body: { timezone, forceRefresh: true },
    });
  };

  const { data } = await invokeLive();

  if (data?.configurationError) {
    console.error("Calendar configuration error:", data.error);
    return cachedData?.events ?? [];
  }

  if (data?.needsAuth) {
    const reconnect = await connectGoogleCalendar({ forceConsent: true });
    if (reconnect.redirected) return cachedData?.events ?? [];
    if (reconnect.error) return cachedData?.events ?? [];
    const { data: retryData } = await invokeLive(reconnect.accessToken);
    return retryData?.events ?? cachedData?.events ?? [];
  }

  return data?.events ?? cachedData?.events ?? [];
};
