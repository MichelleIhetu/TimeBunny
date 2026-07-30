import { AnimatePresence, motion } from "framer-motion";
import bunnyMascot from "@/assets/bunny-mascot.png";
import type { GoalWithProgress } from "@/hooks/useGoals";

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

type Props = {
  goal: GoalWithProgress | null;
  onDismiss: () => void;
};

export default function GoalCarrotCelebration({ goal, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {goal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#fdf4ff]/90 px-4"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="max-w-sm w-full border-2 border-[#5b21b6] bg-white p-6 text-center shadow-[8px_8px_0px_#a78bfa]"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.img
              src={bunnyMascot}
              alt=""
              aria-hidden
              draggable={false}
              className="mx-auto mb-4 h-28 w-auto object-contain pixel-img animate-bunny-victory"
            />
            <p className="text-[#5b21b6] text-xs leading-relaxed" style={PIXEL}>
              CARROT HARVESTED!
            </p>
            <p className="mt-3 text-2xl text-[#a78bfa]" style={VT}>
              {goal.title} is complete — TimeBunny is so proud of you!
            </p>
            <p className="mt-2 text-lg text-[#2dd4bf]" style={VT}>
              Your carrot badge just grew by one 🥕
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-5 w-full bg-[#5b21b6] py-3 text-[10px] text-white hover:bg-[#4c1d95]"
              style={PIXEL}
            >
              YAY!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
