import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-provider-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type GoogleRefreshSuccess = { access_token: string; expires_in: number };
type GoogleRefreshFailure = { error: string; code: string; status: number };
type GoogleRefreshResult = GoogleRefreshSuccess | GoogleRefreshFailure;

const isGoogleRefreshFailure = (result: GoogleRefreshResult): result is GoogleRefreshFailure => 'error' in result;

async function refreshGoogleToken(refreshToken: string): Promise<GoogleRefreshResult> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID/SECRET');
    return {
      error: 'Calendar refresh is not configured. Add Google OAuth credentials in the backend settings.',
      code: 'missing_google_oauth_credentials',
      status: 500,
    };
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    const rawText = await resp.text();
    console.error('Google refresh failed:', resp.status, rawText);

    let googleError = '';
    let googleDescription = '';
    try {
      const parsed = JSON.parse(rawText);
      googleError = parsed?.error || '';
      googleDescription = parsed?.error_description || '';
    } catch {
      googleDescription = rawText;
    }

    if (googleError === 'invalid_client') {
      return {
        error: 'Calendar refresh is misconfigured: the saved Google client secret is invalid. Update the Google OAuth credentials in the backend, then reconnect Calendar once.',
        code: 'invalid_google_oauth_client',
        status: 500,
      };
    }

    if (googleError === 'invalid_grant') {
      return {
        error: 'Saved Google Calendar permission expired. Please reconnect Calendar access once.',
        code: 'expired_google_refresh_token',
        status: 401,
      };
    }

    return {
      error: googleDescription || 'Google Calendar token refresh failed.',
      code: 'google_refresh_failed',
      status: resp.status,
    };
  }
  return await resp.json();
}

type StoredGoogleToken = {
  refresh_token: string | null;
  access_token: string | null;
  expires_at: string | null;
};

function jwtHasSubject(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded?.sub === 'string' && decoded.sub.length > 0;
  } catch {
    return false;
  }
}

function isCalendarAuthError(status: number, errorText: string): boolean {
  const normalized = errorText.toLowerCase();
  return status === 401 || status === 403 ||
    normalized.includes('insufficient authentication scopes') ||
    normalized.includes('access_token_scope_insufficient') ||
    normalized.includes('insufficient permission') ||
    normalized.includes('invalid credentials');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    if (!jwtHasSubject(token)) {
      return new Response(
        JSON.stringify({ error: 'Please sign in to use Google Calendar.', needsAuth: true, events: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching calendar for user:', user.id);

    const admin = createClient(supabaseUrl, serviceKey);

    const getCachedCalendar = async () => {
      const { data: cached } = await admin
        .from('cached_calendar_events')
        .select('events, fetched_at')
        .eq('user_id', user.id)
        .maybeSingle();
      return cached;
    };

    // Parse body first (so we can also check for cacheOnly flag)
    let timezone = 'UTC';
    let timeMin = '';
    let timeMax = '';
    let cacheOnly = false;
    let forceRefresh = false;
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
      if (body?.timezone) timezone = body.timezone as string;
      if (body?.cacheOnly) cacheOnly = true;
      if (body?.forceRefresh) forceRefresh = true;
      if (body?.timeMin) timeMin = body.timeMin as string;
      if (body?.timeMax) timeMax = body.timeMax as string;
    } catch {}

    if (body?.action === 'removeEvent') {
      const eventId = typeof body.eventId === 'string' ? body.eventId : '';
      const calendarHint = typeof body.calendarHint === 'string' ? body.calendarHint : 'primary';
      if (!eventId) {
        return new Response(
          JSON.stringify({ error: 'eventId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: storedTokens } = await admin
        .from('google_oauth_tokens')
        .select('refresh_token, access_token, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const refreshAndStoreProviderToken = async (): Promise<GoogleRefreshResult & { token?: string }> => {
        if (!storedTokens?.refresh_token) {
          return { error: 'No refresh token', code: 'missing_refresh_token', status: 401 };
        }
        const refreshed = await refreshGoogleToken(storedTokens.refresh_token);
        if (isGoogleRefreshFailure(refreshed)) return refreshed;
        await admin.from('google_oauth_tokens').upsert({
          user_id: user.id,
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          refresh_token: storedTokens.refresh_token,
        }, { onConflict: 'user_id' });
        return { ...refreshed, token: refreshed.access_token };
      };

      let providerToken = '';
      const headerProviderToken = req.headers.get('x-provider-token') || '';
      const stored = storedTokens as StoredGoogleToken | null;
      const storedFresh = !!(stored?.access_token && stored.expires_at &&
        new Date(stored.expires_at).getTime() - Date.now() > 120_000);

      if (storedFresh) {
        providerToken = stored!.access_token!;
      } else if (stored?.refresh_token) {
        const refreshAttempt = await refreshAndStoreProviderToken();
        providerToken = refreshAttempt.token || headerProviderToken;
      } else {
        providerToken = headerProviderToken;
      }

      if (!providerToken) {
        return new Response(
          JSON.stringify({ error: 'Google Calendar not connected', needsAuth: true, needsWriteScope: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const resolveCalendarId = async (token: string): Promise<string> => {
        if (calendarHint.includes('@')) return calendarHint;
        if (calendarHint !== 'primary' && calendarHint !== 'calendar') return calendarHint;
        const listResp = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listResp.ok) return 'primary';
        const listData = await listResp.json();
        const primary = (listData.items || []).find((cal: { primary?: boolean; id?: string }) => cal.primary);
        return primary?.id || 'primary';
      };

      const calendarId = await resolveCalendarId(providerToken);
      const deleteEvent = (token: string) =>
        fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
        );

      let deleteResp = await deleteEvent(providerToken);
      if (!deleteResp.ok && (deleteResp.status === 401 || deleteResp.status === 403)) {
        const refreshAttempt = await refreshAndStoreProviderToken();
        if (refreshAttempt.token) {
          providerToken = refreshAttempt.token;
          deleteResp = await deleteEvent(providerToken);
        }
      }

      const cancelEvent = (token: string) =>
        fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'cancelled' }),
          },
        );

      if (!deleteResp.ok && deleteResp.status !== 404) {
        const cancelResp = await cancelEvent(providerToken);
        if (cancelResp.ok) {
          deleteResp = cancelResp;
        }
      }

      if (deleteResp.status === 404) {
        return new Response(
          JSON.stringify({ success: true, calendarId, alreadyRemoved: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!deleteResp.ok && deleteResp.status !== 404) {
        const errText = await deleteResp.text();
        const needsWriteScope =
          deleteResp.status === 403 &&
          /insufficient|scope|permission|forbidden/i.test(errText);
        return new Response(
          JSON.stringify({
            error: needsWriteScope
              ? 'Calendar write access is required. Re-sync calendar from Welcome Back to grant permission.'
              : 'Failed to remove calendar event.',
            needsWriteScope,
            calendarId,
            status: deleteResp.status,
            details: errText.slice(0, 240),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      try {
        const cached = await admin
          .from('cached_calendar_events')
          .select('events')
          .eq('user_id', user.id)
          .maybeSingle();
        const events = Array.isArray(cached?.events) ? cached.events : [];
        const compositeSuffix = `-${calendarHint}`;
        const filtered = events.filter((e: { id?: string }) => {
          const id = e?.id || '';
          return id !== `${eventId}${compositeSuffix}` && id !== eventId && !id.startsWith(`${eventId}-`);
        });
        await admin.from('cached_calendar_events').upsert({
          user_id: user.id,
          events: filtered,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (cacheErr) {
        console.error('Failed to update calendar cache after delete:', cacheErr);
      }

      return new Response(
        JSON.stringify({ success: true, calendarId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fallback range: scan the next 31 days (full month horizon) so neurosymbolic
    // reasoning can plan lead time for important upcoming tasks.
    if (!timeMin || !timeMax) {
      const startUtc = new Date();
      startUtc.setUTCHours(0, 0, 0, 0);
      const endUtc = new Date(startUtc);
      endUtc.setUTCDate(endUtc.getUTCDate() + 31);
      timeMin = startUtc.toISOString();
      timeMax = endUtc.toISOString();
    }

    // Cache-only fast path: just return what we have, no Google call.
    if (cacheOnly) {
      const cached = await getCachedCalendar();
      return new Response(
        JSON.stringify({ events: cached?.events || [], fromCache: true, fetchedAt: cached?.fetched_at || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authRequiredResponse = async (message = 'Google Calendar access needs a fresh permission grant.') => {
      const cached = await getCachedCalendar();
      return new Response(
        JSON.stringify({
          error: message,
          needsAuth: true,
          calendarScopeMissing: true,
          events: cached?.events || [],
          fromCache: !!cached,
          fetchedAt: cached?.fetched_at || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    const calendarConfigErrorResponse = async (message: string, code: string) => {
      const cached = await getCachedCalendar();
      return new Response(
        JSON.stringify({
          error: message,
          code,
          needsAuth: false,
          retryable: false,
          configurationError: true,
          events: cached?.events || [],
          fromCache: !!cached,
          fetchedAt: cached?.fetched_at || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    const { data: storedTokens } = await admin
      .from('google_oauth_tokens')
      .select('refresh_token, access_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    let stored = (storedTokens || null) as StoredGoogleToken | null;

    const refreshAndStoreProviderToken = async (): Promise<{ token: string | null; failure: GoogleRefreshFailure | null }> => {
      if (!stored?.refresh_token) return { token: null, failure: null };
      const refreshed = await refreshGoogleToken(stored.refresh_token);
      if (isGoogleRefreshFailure(refreshed)) return { token: null, failure: refreshed };
      if (!refreshed?.access_token) return { token: null, failure: null };

      const expiresAt = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString();
      await admin.from('google_oauth_tokens').update({
        access_token: refreshed.access_token,
        expires_at: expiresAt,
      }).eq('user_id', user.id);

      stored = {
        ...stored,
        access_token: refreshed.access_token,
        expires_at: expiresAt,
      };

      return { token: refreshed.access_token, failure: null };
    };

    // Resolve a Google access token. Prefer a saved access token that still has
    // >2 min of life. Otherwise silently refresh using the saved refresh token.
    // The session-provided header is only a last resort, since it may itself be
    // stale on the first request of a new day.
    const storedFresh = !forceRefresh && !!(stored?.access_token && stored.expires_at &&
      new Date(stored.expires_at).getTime() - Date.now() > 120_000);
    const headerProviderToken = req.headers.get('x-provider-token') || '';

    let providerToken = '';
    if (storedFresh) {
      providerToken = stored!.access_token!;
    } else if (stored?.refresh_token) {
      const refreshAttempt = await refreshAndStoreProviderToken();
      providerToken = refreshAttempt.token || '';
      if (!providerToken) {
        if (headerProviderToken) {
          providerToken = headerProviderToken;
        } else {
          if (refreshAttempt.failure?.code === 'invalid_google_oauth_client' || refreshAttempt.failure?.code === 'missing_google_oauth_credentials') {
            return await calendarConfigErrorResponse(refreshAttempt.failure.error, refreshAttempt.failure.code);
          }
          return await authRequiredResponse(refreshAttempt.failure?.error);
        }
      }
    } else if (headerProviderToken) {
      providerToken = headerProviderToken;
    } else {
      return await authRequiredResponse('No Google credentials. Sign in with Google to refresh.');
    }

    console.log('Using timezone:', timezone);
    console.log('Fetching events from', timeMin, 'to', timeMax);

    const fetchCalendarList = (tokenToUse: string) => fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: { Authorization: `Bearer ${tokenToUse}` } }
    );

    // Fetch all visible calendars first (not only "primary"). If the access
    // token is expired/revoked, silently refresh once and retry before asking
    // the user to re-consent.
    let calendarsResponse = await fetchCalendarList(providerToken);

    if (!calendarsResponse.ok) {
      const errorText = await calendarsResponse.text();
      console.error('Google Calendar list API error:', calendarsResponse.status, errorText);
      if (isCalendarAuthError(calendarsResponse.status, errorText)) {
        const refreshAttempt = await refreshAndStoreProviderToken();
        if (refreshAttempt.token) {
          providerToken = refreshAttempt.token;
          calendarsResponse = await fetchCalendarList(providerToken);
        }

        if (!refreshAttempt.token || !calendarsResponse.ok) {
          if (refreshAttempt.failure?.code === 'invalid_google_oauth_client' || refreshAttempt.failure?.code === 'missing_google_oauth_credentials') {
            return await calendarConfigErrorResponse(refreshAttempt.failure.error, refreshAttempt.failure.code);
          }
          return await authRequiredResponse('Google Calendar permission is missing or expired. Please reconnect Calendar access.');
        }
      }

      if (!calendarsResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch calendar list', details: errorText }),
          { status: calendarsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const calendarsData = await calendarsResponse.json();
    const calendars = (calendarsData.items || [])
      .filter((cal: any) => cal?.id && cal?.accessRole && cal.accessRole !== 'none')
      .map((cal: any) => ({ id: cal.id as string, summary: cal.summary as string }));

    // Fallback to primary if list is empty for any reason
    const calendarIds = calendars.length > 0
      ? calendars
      : [{ id: 'primary', summary: 'Primary Calendar' }];

    const fetchCalendarEvents = (calendarId: string, tokenToUse: string) => fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `timeZone=${encodeURIComponent(timezone)}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      { headers: { Authorization: `Bearer ${tokenToUse}` } }
    );

    const mergedItems: any[] = [];
    const perCalendar: Array<{ id: string; summary: string; rawCount: number; error?: string }> = [];
    for (const calendar of calendarIds) {
      let response = await fetchCalendarEvents(calendar.id, providerToken);

      if (!response.ok) {
        const err = await response.text();
        console.error(`Google Calendar API error for ${calendar.id}:`, response.status, err);

        if (isCalendarAuthError(response.status, err)) {
          const refreshAttempt = await refreshAndStoreProviderToken();
          if (refreshAttempt.token) {
            providerToken = refreshAttempt.token;
            response = await fetchCalendarEvents(calendar.id, providerToken);
          }

          if (!refreshAttempt.token || !response.ok) {
            if (refreshAttempt.failure?.code === 'invalid_google_oauth_client' || refreshAttempt.failure?.code === 'missing_google_oauth_credentials') {
              return await calendarConfigErrorResponse(refreshAttempt.failure.error, refreshAttempt.failure.code);
            }
            return await authRequiredResponse('Google Calendar permission is missing or expired. Please reconnect Calendar access.');
          }
        } else {
          perCalendar.push({ id: calendar.id, summary: calendar.summary, rawCount: 0, error: `HTTP ${response.status}` });
          continue;
        }
      }

      const data = await response.json();
      const items = data.items || [];
      perCalendar.push({ id: calendar.id, summary: calendar.summary, rawCount: items.length });
      mergedItems.push(...items.map((item: any) => ({ ...item, _calendarName: calendar.summary })));
    }
    console.log('Fetched', mergedItems.length || 0, 'events across', calendarIds.length, 'calendars');
    console.log('Per-calendar breakdown:', JSON.stringify(perCalendar));


    // Helper: format a date-time string to HH:MM in the user's timezone
    const toLocalHHMM = (dateTimeStr: string, tz: string): string => {
      try {
        const d = new Date(dateTimeStr);
        const parts = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: tz,
        }).formatToParts(d);
        const hour = parts.find(p => p.type === 'hour')?.value || '00';
        const minute = parts.find(p => p.type === 'minute')?.value || '00';
        return `${hour}:${minute}`;
      } catch {
        // Fallback: extract from ISO string
        const d = new Date(dateTimeStr);
        return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      }
    };

    // Get "now" in the user's timezone for filtering past events
    const nowISO = new Date().toISOString();

    const events = mergedItems
      .filter((item: any) => {
        // Keep all-day events
        if (!item.start?.dateTime) return true;
        // Filter out events whose end time has already passed
        const endDateTime = item.end?.dateTime || item.start?.dateTime;
        return new Date(endDateTime) > new Date(nowISO);
      })
      .map((item: any) => {
        const startDateTime = item.start?.dateTime || item.start?.date;
        const endDateTime = item.end?.dateTime || item.end?.date;
        const isAllDay = !item.start?.dateTime;

        let startTime = '';
        let endTime = '';

        if (!isAllDay && startDateTime) {
          startTime = toLocalHHMM(startDateTime, timezone);
        }
        if (!isAllDay && endDateTime) {
          endTime = toLocalHHMM(endDateTime, timezone);
        }

        // Local YYYY-MM-DD for lead-time planning
        let date = '';
        try {
          const d = new Date(startDateTime);
          const parts = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone,
          }).formatToParts(d);
          const y = parts.find(p => p.type === 'year')?.value;
          const mo = parts.find(p => p.type === 'month')?.value;
          const da = parts.find(p => p.type === 'day')?.value;
          if (y && mo && da) date = `${y}-${mo}-${da}`;
        } catch {
          date = (startDateTime || '').slice(0, 10);
        }

        return {
          id: `${item.id}-${item.organizer?.email || item._calendarName || 'calendar'}`,
          title: item.summary || 'Untitled Event',
          date,
          startTime,
          endTime,
          description: item.description || '',
          isAllDay,
        };
      });

    // Cache the fetched events for fast subsequent loads
    try {
      await admin.from('cached_calendar_events').upsert({
        user_id: user.id,
        events,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Failed to cache events:', e);
    }

    return new Response(
      JSON.stringify({
        events,
        fromCache: false,
        diagnostics: {
          timezone,
          timeMin,
          timeMax,
          calendarsScanned: calendarIds.length,
          rawEventCount: mergedItems.length,
          filteredEventCount: events.length,
          perCalendar,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },

    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in google-calendar function:', error);
    return new Response(
      JSON.stringify({ error: 'GOOGLE_CALENDAR_SERVICE_FAILED', details: errorMessage, fallback: true, events: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
