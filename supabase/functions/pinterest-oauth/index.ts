import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PINTEREST_SCOPES = "boards:read,pins:read,user_accounts:read";
const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const API_BASE = "https://api.pinterest.com/v5";

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  return { user, admin };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isConfigured() {
  return Boolean(Deno.env.get("PINTEREST_APP_ID") && Deno.env.get("PINTEREST_APP_SECRET"));
}

function pinterestCredentials() {
  const clientId = Deno.env.get("PINTEREST_APP_ID");
  const clientSecret = Deno.env.get("PINTEREST_APP_SECRET");
  if (!clientId || !clientSecret) {
    return { error: "Pinterest API is not configured yet. Add PINTEREST_APP_ID and PINTEREST_APP_SECRET to Supabase secrets when ready." };
  }
  return { clientId, clientSecret, basicAuth: btoa(`${clientId}:${clientSecret}`) };
}

async function exchangeToken(body: Record<string, string>, basicAuth: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error_description || "Pinterest token exchange failed");
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

async function saveTokens(
  admin: ReturnType<typeof createClient>,
  userId: string,
  tokens: { access_token: string; refresh_token?: string | null; expires_in?: number; scope?: string },
  username?: string | null,
) {
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + (Number(tokens.expires_in) - 60) * 1000).toISOString()
    : null;

  const { error } = await admin.from("pinterest_oauth_tokens").upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tokens.scope ?? PINTEREST_SCOPES,
      pinterest_username: username ?? null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

async function fetchPinterestUsername(accessToken: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}/user_account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.username || data.profile_url?.split("/").filter(Boolean).pop() || null;
}

async function getValidAccessToken(admin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const creds = pinterestCredentials();
  if ("error" in creds) return null;

  const { data: row } = await admin
    .from("pinterest_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row?.access_token && !row?.refresh_token) return null;

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const stillValid = row.access_token && expiresAt > Date.now() + 60_000;
  if (stillValid) return row.access_token as string;

  if (!row.refresh_token) return row.access_token as string | null;

  const refreshed = await exchangeToken(
    { grant_type: "refresh_token", refresh_token: row.refresh_token },
    creds.basicAuth,
  );
  await saveTokens(admin, userId, {
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? row.refresh_token,
  });
  return refreshed.access_token;
}

function pinImageUrl(pin: Record<string, unknown>): string | null {
  const media = pin.media as { images?: Record<string, { url?: string }> } | undefined;
  if (!media?.images) return null;
  const sizes = ["1200x", "736x", "564x", "474x", "236x", "170x"];
  for (const size of sizes) {
    const url = media.images[size]?.url;
    if (url) return url;
  }
  const first = Object.values(media.images).find((img) => img?.url);
  return first?.url ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "config") {
      return json({ success: true, configured: isConfigured() });
    }

    if (action === "getAuthUrl") {
      const creds = pinterestCredentials();
      if ("error" in creds) return json({ success: false, configured: false, error: creds.error }, 503);

      const auth = await requireUser(req);
      if ("error" in auth) return auth.error;

      const redirectUri = body.redirectUri as string;
      if (!redirectUri) return json({ success: false, error: "redirectUri required" }, 400);

      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: creds.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: PINTEREST_SCOPES,
        state,
      });

      return json({
        success: true,
        configured: true,
        authUrl: `https://www.pinterest.com/oauth/?${params.toString()}`,
        state,
      });
    }

    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;
    const { user, admin } = auth;

    if (action === "exchangeCode") {
      const creds = pinterestCredentials();
      if ("error" in creds) return json({ success: false, error: creds.error }, 500);

      const code = body.code as string;
      const redirectUri = body.redirectUri as string;
      if (!code || !redirectUri) return json({ success: false, error: "code and redirectUri required" }, 400);

      const tokens = await exchangeToken(
        { grant_type: "authorization_code", code, redirect_uri: redirectUri },
        creds.basicAuth,
      );
      const username = await fetchPinterestUsername(tokens.access_token);
      await saveTokens(admin, user.id, tokens, username);

      return json({ success: true, username });
    }

    if (action === "status") {
      const { data: row } = await admin
        .from("pinterest_oauth_tokens")
        .select("pinterest_username, expires_at, access_token, refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      const connected = Boolean(row?.access_token || row?.refresh_token);
      return json({
        success: true,
        configured: isConfigured(),
        connected,
        username: row?.pinterest_username ?? null,
      });
    }

    if (action === "disconnect") {
      await admin.from("pinterest_oauth_tokens").delete().eq("user_id", user.id);
      return json({ success: true });
    }

    const accessToken = await getValidAccessToken(admin, user.id);
    if (!accessToken) {
      return json({ success: false, error: "Connect your Pinterest account first", needsAuth: true }, 401);
    }

    if (action === "listBoards") {
      const response = await fetch(`${API_BASE}/boards?page_size=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return json({ success: false, error: data.message || "Failed to load boards" }, response.status);
      }

      const boards = (data.items || []).map((board: Record<string, unknown>) => ({
        id: board.id,
        name: board.name,
        description: board.description,
        pinCount: board.pin_count,
        imageUrl: (board.media as { image_cover_url?: string } | undefined)?.image_cover_url ?? null,
      }));

      return json({ success: true, boards });
    }

    if (action === "listBoardPins") {
      const boardId = body.boardId as string;
      if (!boardId) return json({ success: false, error: "boardId required" }, 400);

      const response = await fetch(`${API_BASE}/boards/${encodeURIComponent(boardId)}/pins?page_size=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return json({ success: false, error: data.message || "Failed to load pins" }, response.status);
      }

      const images = (data.items || [])
        .map((pin: Record<string, unknown>) => {
          const imageUrl = pinImageUrl(pin);
          if (!imageUrl) return null;
          return {
            imageUrl,
            title: (pin.title as string) || "Pinterest Pin",
            sourceUrl: (pin.link as string) || `https://www.pinterest.com/pin/${pin.id}/`,
          };
        })
        .filter(Boolean);

      return json({ success: true, images });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (error) {
    console.error("pinterest-oauth error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message }, 500);
  }
});
