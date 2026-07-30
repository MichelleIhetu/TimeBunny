import { Calendar, Loader2 } from "lucide-react";
import { useEventKitCalendar } from "@/hooks/useEventKitCalendar";

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

interface Props {
  onConnected?: () => void;
  className?: string;
}

/**
 * Shown on iOS native builds to request EventKit calendar access.
 * Hidden on web until Capacitor shell is running.
 */
export function EventKitConnectPanel({ onConnected, className = "" }: Props) {
  const { isAvailable, bridgeReady, permission, setupHint, requestAccess } = useEventKitCalendar();

  if (!isAvailable) return null;
  if (permission === "granted") return null;

  const handleConnect = async () => {
    const status = await requestAccess();
    if (status === "granted") onConnected?.();
  };

  return (
    <div
      className={`rounded-2xl border-2 border-[#5b21b6] bg-[#fdf4ff] p-4 shadow-[4px_4px_0_#a78bfa] ${className}`}
    >
      <div className="flex items-start gap-3">
        <Calendar className="w-5 h-5 text-[#5b21b6] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[#5b21b6] text-[9px] sm:text-[10px] leading-relaxed" style={PIXEL}>
            APPLE CALENDAR
          </p>
          <p className="text-[#7c6a9a] text-lg mt-1 leading-snug" style={VT}>
            {bridgeReady
              ? "Allow TimeBunny to read your calendar so we can plan around your events."
              : setupHint}
          </p>
        </div>
      </div>

      {bridgeReady && permission !== "granted" && (
        <button
          type="button"
          onClick={handleConnect}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-[9px] text-white bg-[#5b21b6] border-2 border-[#5b21b6] shadow-[3px_3px_0px_#a78bfa]"
          style={PIXEL}
        >
          ALLOW CALENDAR ACCESS
        </button>
      )}

      {!bridgeReady && (
        <p className="mt-2 text-[#a78bfa] text-base flex items-center gap-2" style={VT}>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Waiting for native EventKit plugin…
        </p>
      )}
    </div>
  );
}
