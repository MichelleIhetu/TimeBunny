import { motion } from "framer-motion";

type Props = {
  /** 0 at session start, 1 when time is up. */
  progress: number;
  running: boolean;
};

/** Two identical periods so a -50% translate loops cleanly. */
const WAVE =
  "M0 200 C200 130 400 270 600 200 S1000 130 1200 200 S1400 270 1600 200 S2000 130 2400 200";

/**
 * Room-lavender checkerboard (#EDCBF6) with drifting light/shadow waves.
 * Waves lift through mid-session, then settle as time runs out.
 */
export default function PomodoroCheckerBackground({ progress, running }: Props) {
  const t = Math.min(1, Math.max(0, progress));
  const lift = Math.sin(t * Math.PI);
  const shift = 6 - lift * 20;
  const play = running ? "running" : "paused";

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute inset-0 pomodoro-checker-board" />

      <motion.div
        className="absolute inset-0"
        animate={{ y: `${shift}%` }}
        transition={
          running
            ? { type: "tween", duration: 1.2, ease: "easeInOut" }
            : { duration: 0 }
        }
      >
        <div className="absolute inset-0 pomodoro-wave-bob" style={{ animationPlayState: play }}>
        <svg
          className="pomodoro-wave pomodoro-wave-a"
          viewBox="0 0 2400 400"
          preserveAspectRatio="none"
          style={{ animationPlayState: play }}
        >
          <path fill="none" stroke="rgba(255, 255, 255, 0.42)" strokeWidth="92" d={WAVE} />
        </svg>
        <svg
          className="pomodoro-wave pomodoro-wave-b"
          viewBox="0 0 2400 400"
          preserveAspectRatio="none"
          style={{ animationPlayState: play }}
        >
          <path fill="none" stroke="rgba(210, 168, 228, 0.4)" strokeWidth="110" d={WAVE} />
        </svg>
        <svg
          className="pomodoro-wave pomodoro-wave-c"
          viewBox="0 0 2400 400"
          preserveAspectRatio="none"
          style={{ animationPlayState: play }}
        >
          <path fill="none" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="70" d={WAVE} />
        </svg>
        </div>
      </motion.div>
    </div>
  );
}
