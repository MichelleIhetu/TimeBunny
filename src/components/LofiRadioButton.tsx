import { Headphones, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  playing: boolean;
  trackTitle?: string | null;
  onToggle: () => void;
  className?: string;
};

export default function LofiRadioButton({ playing, trackTitle, onToggle, className }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={playing}
      aria-label={playing ? "Pause lofi radio" : "Play lofi radio"}
      title={
        playing && trackTitle
          ? `Lo-Fi on · ${trackTitle} (Mixkit — royalty free)`
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
  );
}
