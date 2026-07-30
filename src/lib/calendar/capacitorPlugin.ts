/**
 * Capacitor plugin registration (TypeScript).
 * After `npm install @capacitor/core`, uncomment and register in App.tsx on native boot.
 *
 * import { registerPlugin } from '@capacitor/core';
 * import type { EventKitNativeBridge } from '@/lib/calendar/nativeBridge';
 *
 * export const TimeBunnyCalendar = registerPlugin<EventKitNativeBridge>('TimeBunnyCalendar');
 *
 * // On iOS app launch:
 * import { registerEventKitBridge } from '@/lib/calendar';
 * registerEventKitBridge(TimeBunnyCalendar);
 */

import type { EventKitNativeBridge } from "@/lib/calendar/nativeBridge";

export type TimeBunnyCalendarPlugin = EventKitNativeBridge;

/** Placeholder until Capacitor is added to the project. */
export const TimeBunnyCalendar: TimeBunnyCalendarPlugin | null = null;
