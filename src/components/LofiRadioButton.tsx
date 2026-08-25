import { Headphones, Pause } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  playing: boolean;
  trackTitle?: string | null;
  trackArtist?: string | null;
  onToggle: () => void;
  className?: string;
};

export default function LofiRadioButton({
  playing,
  trackTitle,
  trackArtist,
  onToggle,
  className,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={playing}
        aria-label={playing ? "Pause lofi radio" : "Play lofi radio"}
        title={
          playing && trackTitle
            ? `Lo-Fi on · ${trackTitle}${trackArtist ? ` — ${trackArtist}` : ""} (Mixkit — royalty free)`
            : "Soft lofi radio for focus (Mixkit — royalty free)"
        }
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 border-2",
          playing
            ? "text-white border-[#7c3aed] bg-[#6d28d9]"
            : "text-[#5b21b6] border-[#ddd6fe] bg-white/95",
          className,
        )}
        style={{ fontFamily: "var(--font-body)" }}
      >
        {playing ? <Pause className="w-4 h-4 shrink-0" /> : <Headphones className="w-4 h-4 shrink-0" />}
        <span className="text-xs font-semibold tracking-wide">Lo-Fi</span>
      </button>

      <AnimatePresence>
        {playing && trackTitle ? (
          <motion.div
            key={trackTitle}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="pointer-events-none fixed inset-x-0 top-16 z-[61] flex justify-center px-4 sm:top-3 sm:px-28"
          >
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto max-w-[min(72vw,340px)] rounded-full border-2 px-4 py-2 shadow-lg"
              style={{
                fontFamily: "var(--font-body)",
                background: "hsl(40 60% 97% / 0.94)",
                borderColor: "hsl(280 45% 72%)",
                boxShadow: "3px 3px 0px hsl(280 40% 70%)",
                color: "hsl(280 40% 25%)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "hsl(280 40% 48%)" }}>
                Now playing
              </p>
              <div className="mt-0.5 flex items-center gap-2 min-w-0">
                <span className="flex h-3 w-3 shrink-0 items-end justify-between gap-[2px]" aria-hidden>
                  {[0, 0.15, 0.28].map((delay) => (
                    <motion.span
                      key={delay}
                      className="w-[3px] rounded-full bg-[#7c3aed]"
                      animate={{ height: ["4px", "12px", "4px"] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay, ease: "easeInOut" }}
                    />
                  ))}
                </span>
                <p className="truncate text-sm font-semibold leading-tight">
                  {trackTitle}
                  {trackArtist ? (
                    <span className="font-medium opacity-70"> · {trackArtist}</span>
                  ) : null}
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
