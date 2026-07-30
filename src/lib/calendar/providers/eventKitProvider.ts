import type {
  CalendarDateRange,
  CalendarFetchResult,
  CalendarPermissionStatus,
  CalendarProvider,
} from "@/types/calendarProvider";
import {
  eventKitFetchEvents,
  eventKitGetPermissionStatus,
  eventKitRequestPermission,
  eventKitSubscribeToChanges,
  isEventKitBridgeAvailable,
  isNativeIOSApp,
  onEventKitBridgeReady,
} from "@/lib/calendar/nativeBridge";
import { normalizeEventKitEvents } from "@/lib/calendar/normalizeEventKit";

export const EVENTKIT_PERMISSION_CHANGED = "timebunny:eventkit-permission-changed";

export const eventKitCalendarProvider: CalendarProvider = {
  id: "apple_eventkit",
  displayName: "Apple Calendar",
  capabilities: {
    canAutoSync: true,
    requiresOAuth: false,
    requiresNativePermission: true,
    supportsChangeNotifications: true,
  },

  isAvailable() {
    return isNativeIOSApp() || isEventKitBridgeAvailable();
  },

  async getPermissionStatus(): Promise<CalendarPermissionStatus> {
    if (!isEventKitBridgeAvailable()) {
      return isNativeIOSApp() ? "not_determined" : "unavailable";
    }
    return eventKitGetPermissionStatus();
  },

  async requestPermission(): Promise<CalendarPermissionStatus> {
    if (!isEventKitBridgeAvailable()) {
      return "unavailable";
    }
    const status = await eventKitRequestPermission();
    window.dispatchEvent(
      new CustomEvent(EVENTKIT_PERMISSION_CHANGED, { detail: { status } }),
    );
    return status;
  },

  async fetchEvents(range: CalendarDateRange, _opts?: { forceRefresh?: boolean }): Promise<CalendarFetchResult> {
    if (!isEventKitBridgeAvailable()) {
      if (isNativeIOSApp()) {
        return {
          events: [],
          needsPermission: true,
          error: "EventKit bridge not registered. Wire native/ios/TimeBunnyCalendarPlugin.swift.",
          provider: "apple_eventkit",
        };
      }
      return { events: [], provider: "apple_eventkit" };
    }

    const status = await eventKitGetPermissionStatus();
    if (status !== "granted") {
      return {
        events: [],
        needsPermission: true,
        provider: "apple_eventkit",
      };
    }

    try {
      const timezone = range.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
      const payloads = await eventKitFetchEvents(range);
      return {
        events: normalizeEventKitEvents(payloads, timezone),
        provider: "apple_eventkit",
      };
    } catch (err) {
      return {
        events: [],
        error: err instanceof Error ? err.message : "EventKit fetch failed",
        provider: "apple_eventkit",
      };
    }
  },
};

/** Subscribe to native EventKit store changes (iOS only). Returns unsubscribe fn. */
export async function subscribeToEventKitChanges(onChange: () => void): Promise<(() => void) | null> {
  if (!isEventKitBridgeAvailable()) {
    return new Promise((resolve) => {
      const off = onEventKitBridgeReady(async () => {
        off();
        resolve(await eventKitSubscribeToChanges(onChange));
      });
    });
  }
  return eventKitSubscribeToChanges(onChange);
}

export function getEventKitSetupHint(): string {
  if (isEventKitBridgeAvailable()) return "EventKit bridge connected.";
  if (isNativeIOSApp()) {
    return "Add TimeBunnyCalendarPlugin to your iOS target and call registerEventKitBridge on load.";
  }
  return "Apple Calendar sync uses EventKit in the native iOS app.";
}
