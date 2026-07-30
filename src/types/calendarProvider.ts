/**
 * Shared calendar types for web (Google, ICS) and future native iOS (EventKit).
 * Native Swift should serialize events into NativeEventKitEventPayload.
 */

export type CalendarProviderId = "google" | "apple_eventkit" | "ics";

export type CalendarPermissionStatus =
  | "granted"
  | "denied"
  | "not_determined"
  | "restricted"
  | "unavailable";

export interface CalendarDateRange {
  /** ISO-8601 inclusive start */
  timeMin: string;
  /** ISO-8601 inclusive end */
  timeMax: string;
  timezone?: string;
}

/** Canonical event shape used across all providers and schedule analysis. */
export interface NormalizedCalendarEvent {
  id: string;
  title: string;
  /** Local YYYY-MM-DD */
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  isAllDay?: boolean;
  source: CalendarProviderId;
  sourceCalendarId?: string;
  sourceCalendarTitle?: string;
  externalUrl?: string;
  lastModified?: string;
}

/** Payload returned by native EventKit (Capacitor plugin or WKWebView bridge). */
export interface NativeEventKitEventPayload {
  eventIdentifier: string;
  title: string;
  startDateIso: string;
  endDateIso: string;
  isAllDay: boolean;
  notes?: string;
  calendarIdentifier?: string;
  calendarTitle?: string;
  lastModifiedDateIso?: string;
  url?: string;
}

export interface NativeEventKitPermissionResult {
  status: CalendarPermissionStatus;
  /** iOS EKAuthorizationStatus raw value for debugging */
  rawStatus?: number;
}

export interface NativeEventKitFetchRequest {
  startDateIso: string;
  endDateIso: string;
}

export interface NativeEventKitFetchResult {
  events: NativeEventKitEventPayload[];
}

export interface CalendarProviderCapabilities {
  canAutoSync: boolean;
  requiresOAuth: boolean;
  requiresNativePermission: boolean;
  supportsChangeNotifications: boolean;
}

export interface CalendarFetchResult {
  events: NormalizedCalendarEvent[];
  needsAuth?: boolean;
  needsPermission?: boolean;
  error?: string;
  provider: CalendarProviderId;
}

export interface CalendarProvider {
  id: CalendarProviderId;
  displayName: string;
  capabilities: CalendarProviderCapabilities;
  isAvailable(): boolean | Promise<boolean>;
  getPermissionStatus?(): Promise<CalendarPermissionStatus>;
  requestPermission?(): Promise<CalendarPermissionStatus>;
  fetchEvents(
    range: CalendarDateRange,
    opts?: { forceRefresh?: boolean },
  ): Promise<CalendarFetchResult>;
}

/** Back-compat alias used throughout the app today. */
export type CalendarEvent = NormalizedCalendarEvent;
