/**
 * Dev-only EventKit mock for testing the JS bridge in a browser.
 * Enable: localStorage.setItem('timebunny_mock_eventkit', '1') then refresh.
 */
import { registerEventKitBridge } from "@/lib/calendar/nativeBridge";
import type {
  NativeEventKitEventPayload,
  NativeEventKitFetchRequest,
} from "@/types/calendarProvider";

const MOCK_EVENTS: NativeEventKitEventPayload[] = [
  {
    eventIdentifier: "mock-team-standup",
    title: "Team standup",
    startDateIso: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    endDateIso: new Date(new Date().setHours(9, 30, 0, 0)).toISOString(),
    isAllDay: false,
    calendarTitle: "Work",
    notes: "Mock EventKit event for web dev",
  },
  {
    eventIdentifier: "mock-dentist",
    title: "Dentist appointment",
    startDateIso: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + "T14:00:00.000Z",
    endDateIso: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + "T15:00:00.000Z",
    isAllDay: false,
    calendarTitle: "Personal",
  },
];

let mockGranted = false;

export function installEventKitDevMock(): void {
  if (!import.meta.env.DEV) return;
  if (localStorage.getItem("timebunny_mock_eventkit") !== "1") return;

  registerEventKitBridge({
    async getAuthorizationStatus() {
      return {
        status: mockGranted ? "granted" : "not_determined",
        rawStatus: mockGranted ? 3 : 0,
      };
    },
    async requestPermission() {
      mockGranted = true;
      return { status: "granted", rawStatus: 3 };
    },
    async fetchEvents(request: NativeEventKitFetchRequest) {
      const min = new Date(request.startDateIso).getTime();
      const max = new Date(request.endDateIso).getTime();
      const events = mockGranted
        ? MOCK_EVENTS.filter((e) => {
            const t = new Date(e.startDateIso).getTime();
            return t >= min && t <= max;
          })
        : [];
      return { events };
    },
    async subscribeToChanges(callback) {
      const id = window.setInterval(callback, 60_000);
      return { unsubscribe: () => window.clearInterval(id) };
    },
  });

  console.info("[TimeBunny] EventKit dev mock installed. Disable: localStorage.removeItem('timebunny_mock_eventkit')");
}
