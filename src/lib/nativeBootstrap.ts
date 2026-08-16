import { registerEventKitBridge } from "@/lib/calendar";
import type { EventKitNativeBridge } from "@/lib/calendar/nativeBridge";

/** Capacitor + native plugin setup — safe to call on web (no-ops). */
export async function bootstrapNativeApp(): Promise<void> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const platform = Capacitor.getPlatform();
    document.documentElement.classList.add("native-app", `platform-${platform}`);

    try {
      const { App } = await import("@capacitor/app");
      App.addListener("appUrlOpen", ({ url }) => {
        // OAuth / deep links: forward into the SPA router via custom event.
        window.dispatchEvent(new CustomEvent("timebunny:app-url-open", { detail: { url } }));
      });
    } catch {
      /* @capacitor/app optional until installed */
    }

    if (platform === "ios") {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light });
      } catch {
        /* status bar plugin optional */
      }

      const calendarPlugin = registerPlugin<EventKitNativeBridge>("TimeBunnyCalendar");
      registerEventKitBridge(calendarPlugin);
    }
  } catch (err) {
    console.warn("[TimeBunny] native bootstrap skipped:", err);
  }
}
