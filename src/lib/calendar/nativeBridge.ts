import type {
  CalendarDateRange,
  CalendarPermissionStatus,
  NativeEventKitEventPayload,
  NativeEventKitFetchRequest,
  NativeEventKitFetchResult,
  NativeEventKitPermissionResult,
} from "@/types/calendarProvider";

/**
 * Contract implemented by the iOS Capacitor plugin or WKWebView injection.
 *
 * Swift reference: native/ios/TimeBunnyCalendarPlugin.swift
 * Register from native code:
 *   window.TimeBunnyEventKit = { requestPermission, fetchEvents, ... }
 */
export interface EventKitNativeBridge {
  getAuthorizationStatus(): Promise<NativeEventKitPermissionResult>;
  requestPermission(): Promise<NativeEventKitPermissionResult>;
  fetchEvents(request: NativeEventKitFetchRequest): Promise<NativeEventKitFetchResult>;
  /** Optional: native emits when EventKit store changes */
  subscribeToChanges?(callback: () => void): Promise<{ unsubscribe: () => void }>;
}

declare global {
  interface Window {
    /** Injected by Capacitor plugin or native shell */
    TimeBunnyEventKit?: EventKitNativeBridge;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: {
        TimeBunnyCalendar?: EventKitNativeBridge;
      };
    };
  }
}

let injectedBridge: EventKitNativeBridge | null = null;

/** Called from native bootstrap or Capacitor plugin registration. */
export function registerEventKitBridge(bridge: EventKitNativeBridge): void {
  injectedBridge = bridge;
  window.TimeBunnyEventKit = bridge;
  window.dispatchEvent(new CustomEvent("timebunny:eventkit-bridge-ready"));
}

export function onEventKitBridgeReady(callback: () => void): () => void {
  if (resolveEventKitBridge()) {
    callback();
    return () => undefined;
  }
  const handler = () => callback();
  window.addEventListener("timebunny:eventkit-bridge-ready", handler);
  return () => window.removeEventListener("timebunny:eventkit-bridge-ready", handler);
}

export function isNativeIOSApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Capacitor?.getPlatform?.() === "ios") return true;
  if (window.Capacitor?.isNativePlatform?.()) {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  return false;
}

export function resolveEventKitBridge(): EventKitNativeBridge | null {
  if (injectedBridge) return injectedBridge;
  if (window.TimeBunnyEventKit) return window.TimeBunnyEventKit;
  return window.Capacitor?.Plugins?.TimeBunnyCalendar ?? null;
}

export function isEventKitBridgeAvailable(): boolean {
  return resolveEventKitBridge() !== null;
}

export async function eventKitGetPermissionStatus(): Promise<CalendarPermissionStatus> {
  const bridge = resolveEventKitBridge();
  if (!bridge) return "unavailable";
  const result = await bridge.getAuthorizationStatus();
  return result.status;
}

export async function eventKitRequestPermission(): Promise<CalendarPermissionStatus> {
  const bridge = resolveEventKitBridge();
  if (!bridge) return "unavailable";
  const result = await bridge.requestPermission();
  return result.status;
}

export async function eventKitFetchEvents(
  range: CalendarDateRange,
): Promise<NativeEventKitEventPayload[]> {
  const bridge = resolveEventKitBridge();
  if (!bridge) return [];

  const result = await bridge.fetchEvents({
    startDateIso: range.timeMin,
    endDateIso: range.timeMax,
  });
  return result.events ?? [];
}

export async function eventKitSubscribeToChanges(onChange: () => void): Promise<(() => void) | null> {
  const bridge = resolveEventKitBridge();
  if (!bridge?.subscribeToChanges) return null;
  const sub = await bridge.subscribeToChanges(onChange);
  return () => sub.unsubscribe();
}
