export const AUTO_FETCH_CALENDAR_KEY = "timebunny_auto_fetch_calendar";

/** True when the URL contains tokens from a finished OAuth redirect. */
export function isOAuthReturn(): boolean {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return (
    hash.includes("access_token=") ||
    hash.includes("provider_token=") ||
    /[?&]code=/.test(search)
  );
}

/** Google Calendar OAuth includes provider tokens in the URL hash. */
export function isGoogleCalendarOAuthReturn(): boolean {
  const hash = window.location.hash || "";
  return hash.includes("provider_token=") || hash.includes("provider_refresh_token=");
}

export function markAutoFetchCalendarAfterSignIn() {
  sessionStorage.setItem(AUTO_FETCH_CALENDAR_KEY, "1");
}

export function consumeAutoFetchCalendarFlag(): boolean {
  const should = sessionStorage.getItem(AUTO_FETCH_CALENDAR_KEY) === "1";
  if (should) sessionStorage.removeItem(AUTO_FETCH_CALENDAR_KEY);
  return should;
}
