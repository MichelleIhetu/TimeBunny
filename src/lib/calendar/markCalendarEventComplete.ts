import { supabase } from "@/integrations/supabase/client";
import {
  googleCalendarEventDeepLink,
  parseGoogleCompositeEventId,
  type ResolvedScheduleCalendarEvent,
} from "@/lib/calendar/scheduleCalendarMatch";
import { eventKitRemoveEvent, resolveEventKitBridge } from "@/lib/calendar/nativeBridge";

export type MarkCalendarResult = {
  ok: boolean;
  openedExternally?: boolean;
  message?: string;
};

export async function markCalendarEventComplete(
  event: ResolvedScheduleCalendarEvent,
): Promise<MarkCalendarResult> {
  if (event.source === "apple_eventkit") {
    const rawId = event.rawEventId ?? event.eventId.replace(/^eventkit:/, "");
    const bridge = resolveEventKitBridge();
    if (bridge?.removeEvent) {
      try {
        await eventKitRemoveEvent(rawId);
        return { ok: true, message: "Removed from Apple Calendar." };
      } catch (err) {
        console.warn("[calendar-complete]", err);
        return {
          ok: false,
          message: err instanceof Error ? err.message : "Could not update Apple Calendar.",
        };
      }
    }
    return {
      ok: false,
      openedExternally: true,
      message: "Open Apple Calendar to mark this event done.",
    };
  }

  const parsed = parseGoogleCompositeEventId(event.eventId);
  if (!parsed) {
    return { ok: false, message: "Could not identify the calendar event." };
  }

  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: {
      action: "removeEvent",
      eventId: parsed.googleEventId,
      calendarHint: parsed.calendarHint,
    },
  });

  if (error) {
    console.warn("[calendar-complete]", error);
  }

  if (data?.success) {
    return { ok: true, message: "Marked done in Google Calendar." };
  }

  const calendarId =
    (typeof data?.calendarId === "string" && data.calendarId) || parsed.calendarHint || "primary";
  const url = googleCalendarEventDeepLink(parsed.googleEventId, calendarId);
  window.open(url, "_blank", "noopener,noreferrer");

  if (data?.needsWriteScope) {
    return {
      ok: false,
      openedExternally: true,
      message: "Opened Google Calendar — reconnect calendar access to remove events automatically.",
    };
  }

  return {
    ok: false,
    openedExternally: true,
    message: data?.error
      ? `${data.error} Opened Google Calendar so you can mark it done there.`
      : "Opened Google Calendar so you can mark it done there.",
  };
}
