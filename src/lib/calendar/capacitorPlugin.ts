/**
 * Capacitor plugin registration for iOS EventKit calendar access.
 * Native Swift: native/ios/TimeBunnyCalendarPlugin.swift
 */
import { registerPlugin } from "@capacitor/core";
import type { EventKitNativeBridge } from "@/lib/calendar/nativeBridge";

export const TimeBunnyCalendar = registerPlugin<EventKitNativeBridge>("TimeBunnyCalendar");

export type TimeBunnyCalendarPlugin = EventKitNativeBridge;
