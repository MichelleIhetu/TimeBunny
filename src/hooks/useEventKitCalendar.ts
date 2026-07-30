import { useCallback, useEffect, useState } from "react";
import type { CalendarPermissionStatus } from "@/types/calendarProvider";
import {
  eventKitCalendarProvider,
  getEventKitSetupHint,
  subscribeToEventKitChanges,
  EVENTKIT_PERMISSION_CHANGED,
} from "@/lib/calendar";
import {
  isEventKitBridgeAvailable,
  isNativeIOSApp,
  onEventKitBridgeReady,
} from "@/lib/calendar/nativeBridge";

type State = {
  isNativeIOS: boolean;
  bridgeReady: boolean;
  permission: CalendarPermissionStatus;
  setupHint: string;
};

/**
 * React hook for EventKit permission + availability.
 * Wire the native plugin, then call requestAccess() from your connect UI.
 */
export function useEventKitCalendar(opts?: { onCalendarChanged?: () => void }) {
  const [state, setState] = useState<State>({
    isNativeIOS: isNativeIOSApp(),
    bridgeReady: isEventKitBridgeAvailable(),
    permission: "unavailable",
    setupHint: getEventKitSetupHint(),
  });

  const refreshPermission = useCallback(async () => {
    const available = await eventKitCalendarProvider.isAvailable();
    if (!available) {
      setState((s) => ({
        ...s,
        bridgeReady: isEventKitBridgeAvailable(),
        permission: isNativeIOSApp() ? "not_determined" : "unavailable",
        setupHint: getEventKitSetupHint(),
      }));
      return;
    }

    const permission = (await eventKitCalendarProvider.getPermissionStatus?.()) ?? "unavailable";
    setState((s) => ({
      ...s,
      bridgeReady: isEventKitBridgeAvailable(),
      permission,
      setupHint: getEventKitSetupHint(),
    }));
  }, []);

  useEffect(() => {
    void refreshPermission();

    const offBridge = onEventKitBridgeReady(() => {
      void refreshPermission();
    });

    const onPermission = (e: Event) => {
      const status = (e as CustomEvent<{ status: CalendarPermissionStatus }>).detail?.status;
      if (status) {
        setState((s) => ({ ...s, permission: status }));
      }
    };
    window.addEventListener(EVENTKIT_PERMISSION_CHANGED, onPermission);

    return () => {
      offBridge();
      window.removeEventListener(EVENTKIT_PERMISSION_CHANGED, onPermission);
    };
  }, [refreshPermission]);

  useEffect(() => {
    if (!opts?.onCalendarChanged) return;
    let unsub: (() => void) | null = null;

    void subscribeToEventKitChanges(opts.onCalendarChanged).then((fn) => {
      unsub = fn ?? null;
    });

    return () => {
      unsub?.();
    };
  }, [opts?.onCalendarChanged]);

  const requestAccess = useCallback(async (): Promise<CalendarPermissionStatus> => {
    const status = (await eventKitCalendarProvider.requestPermission?.()) ?? "unavailable";
    setState((s) => ({ ...s, permission: status }));
    return status;
  }, []);

  return {
    ...state,
    isAvailable: state.bridgeReady || state.isNativeIOS,
    canRequestAccess: state.bridgeReady && state.permission !== "granted",
    refreshPermission,
    requestAccess,
  };
}
