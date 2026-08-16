import { supabase } from "@/integrations/supabase/client";

export type PinterestBoard = {
  id: string;
  name: string;
  description?: string;
  pinCount?: number;
  imageUrl?: string | null;
};

export type PinterestImage = {
  imageUrl: string;
  title: string;
  sourceUrl: string;
};

export type PinterestConnectionStatus = {
  configured: boolean;
  connected: boolean;
  username: string | null;
};

/** Redirect URI — must match Pinterest app settings exactly. */
export const PINTEREST_REDIRECT_PATH = "/moodboard";

const STATE_KEY = "timebunny_pinterest_oauth_state";
const CODE_KEY = "timebunny_pinterest_oauth_code";

export function getPinterestRedirectUri(): string {
  return `${window.location.origin}${PINTEREST_REDIRECT_PATH}`;
}

type InvokeResult<T> = T & { success?: boolean; error?: string; configured?: boolean };

async function invoke<T>(body: Record<string, unknown>): Promise<InvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke("pinterest-oauth", { body });
  if (error) throw new Error(error.message || "Pinterest request failed");
  const result = (data ?? {}) as InvokeResult<T>;
  if (result.success === false) {
    throw new Error(result.error || "Pinterest request failed");
  }
  return result;
}

/** True when PINTEREST_APP_ID + PINTEREST_APP_SECRET are set in Supabase (no login required). */
export async function isPinterestConfigured(): Promise<boolean> {
  try {
    const data = await invoke<{ configured: boolean }>({ action: "config" });
    return Boolean(data.configured);
  } catch {
    return false;
  }
}

export async function getPinterestStatus(): Promise<PinterestConnectionStatus> {
  const data = await invoke<{ configured: boolean; connected: boolean; username: string | null }>({
    action: "status",
  });
  return {
    configured: Boolean(data.configured),
    connected: Boolean(data.connected),
    username: data.username ?? null,
  };
}

export async function startPinterestConnect(): Promise<void> {
  const redirectUri = getPinterestRedirectUri();
  const data = await invoke<{ authUrl: string; state: string }>({
    action: "getAuthUrl",
    redirectUri,
  });
  if (!data.authUrl) throw new Error("Could not start Pinterest login");
  sessionStorage.setItem(STATE_KEY, data.state);
  window.location.href = data.authUrl;
}

export async function completePinterestConnect(code: string, state: string | null): Promise<string | null> {
  if (sessionStorage.getItem(CODE_KEY) === code) {
    throw new Error("Pinterest login already processed");
  }

  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (expectedState && state && expectedState !== state) {
    throw new Error("Pinterest login state mismatch. Please try again.");
  }

  const data = await invoke<{ username: string | null }>({
    action: "exchangeCode",
    code,
    redirectUri: getPinterestRedirectUri(),
  });

  sessionStorage.setItem(CODE_KEY, code);
  return data.username ?? null;
}

export async function disconnectPinterest(): Promise<void> {
  await invoke({ action: "disconnect" });
  sessionStorage.removeItem(CODE_KEY);
}

export async function fetchPinterestBoards(): Promise<PinterestBoard[]> {
  const data = await invoke<{ boards: PinterestBoard[] }>({ action: "listBoards" });
  return data.boards ?? [];
}

export async function fetchPinterestBoardPins(boardId: string): Promise<PinterestImage[]> {
  const data = await invoke<{ images: PinterestImage[] }>({ action: "listBoardPins", boardId });
  return data.images ?? [];
}

export function clearPinterestOAuthParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("pinterest");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * When you have Pinterest API access, set these Supabase secrets and deploy:
 * - PINTEREST_APP_ID
 * - PINTEREST_APP_SECRET
 * Register redirect URI: https://YOUR_DOMAIN/moodboard (and localhost for dev).
 * Deploy: supabase functions deploy pinterest-oauth
 * Migrate: supabase db push (pinterest_oauth_tokens table)
 */
