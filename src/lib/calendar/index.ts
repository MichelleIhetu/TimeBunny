export {
  fetchAllCalendarEvents,
  fetchEventsFromProviders,
  getAvailableCalendarProviders,
  getCalendarProvider,
  getCalendarProviders,
  knownEventIds,
  partitionEventsBySource,
  syncAllCalendarProviders,
} from "@/lib/calendar/calendarService";

export {
  registerEventKitBridge,
  onEventKitBridgeReady,
  isNativeIOSApp,
  isEventKitBridgeAvailable,
  resolveEventKitBridge,
  eventKitGetPermissionStatus,
  eventKitRequestPermission,
  eventKitFetchEvents,
  eventKitSubscribeToChanges,
} from "@/lib/calendar/nativeBridge";
export type { EventKitNativeBridge } from "@/lib/calendar/nativeBridge";

export {
  eventKitCalendarProvider,
  subscribeToEventKitChanges,
  getEventKitSetupHint,
  EVENTKIT_PERMISSION_CHANGED,
} from "@/lib/calendar/providers/eventKitProvider";

export {
  googleCalendarProvider,
  fetchGoogleCalendarEvents,
  buildGoogleDateRange,
} from "@/lib/calendar/providers/googleCalendarProvider";

export {
  icsCalendarProvider,
  setIcsCalendarEvents,
  getIcsCalendarEvents,
  clearIcsCalendarEvents,
} from "@/lib/calendar/providers/icsCalendarProvider";

export {
  normalizeEventKitEvent,
  normalizeEventKitEvents,
  eventKitEventId,
  isEventKitEventId,
} from "@/lib/calendar/normalizeEventKit";

export type {
  CalendarProviderId,
  CalendarPermissionStatus,
  CalendarDateRange,
  NormalizedCalendarEvent,
  NativeEventKitEventPayload,
  CalendarProvider,
  CalendarFetchResult,
} from "@/types/calendarProvider";
