/** Shared route actions used by web floating nav and mobile tab bar. */
export type NavAction =
  | { type: "route"; path: string; state?: Record<string, unknown> }
  | { type: "journal" }
  | { type: "more" };

export type AppNavEntry = {
  id: string;
  label: string;
  match: (pathname: string) => boolean;
  action: NavAction;
  /** Primary tabs appear in the mobile bottom bar; others live in “More”. */
  mobilePrimary?: boolean;
};

export const APP_NAV_ITEMS: AppNavEntry[] = [
  {
    id: "home",
    label: "Home",
    match: (p) => p === "/",
    action: { type: "route", path: "/" },
    mobilePrimary: true,
  },
  {
    id: "calendar",
    label: "Calendar",
    match: () => false,
    action: { type: "route", path: "/", state: { openMonthlyCalendar: true } },
    mobilePrimary: true,
  },
  {
    id: "schedule",
    label: "Schedule",
    match: () => false,
    action: { type: "route", path: "/", state: { openScheduleView: true } },
  },
  {
    id: "goals",
    label: "Goals",
    match: (p) => p === "/goals",
    action: { type: "route", path: "/goals" },
    mobilePrimary: true,
  },
  {
    id: "badges",
    label: "Badges",
    match: (p) => p === "/badges",
    action: { type: "route", path: "/badges" },
  },
  {
    id: "moodboard",
    label: "Moodboard",
    match: (p) => p === "/moodboard",
    action: { type: "route", path: "/moodboard" },
  },
  {
    id: "vibe",
    label: "Vibe Check",
    match: (p) => p === "/vibe-check",
    action: { type: "route", path: "/vibe-check" },
    mobilePrimary: true,
  },
  {
    id: "journal",
    label: "Journal",
    match: () => false,
    action: { type: "journal" },
  },
];

export const MOBILE_PRIMARY_NAV = APP_NAV_ITEMS.filter((item) => item.mobilePrimary);

export const MOBILE_MORE_NAV = APP_NAV_ITEMS.filter((item) => !item.mobilePrimary && item.id !== "journal");
