import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import bunnyMascot from "@/assets/bunny-mascot.png";
import {
  pickEncouragementMessage,
  playEncouragementChime,
  randomEncouragementIntervalMs,
} from "@/lib/pomodoroBunny";
import {
  applyPomodoroBubbleOffset,
  defaultPomodoroBubblePosition,
  defaultPomodoroBunnyPosition,
  getPomodoroBunnyPosition,
  getPomodoroBubblePosition,
  normalizePomodoroSavedPosition,
  POMODORO_BUBBLE_WIDTH_CLASS,
  POMODORO_BUNNY_DEFAULT_CLASS,
  POMODORO_BUNNY_FIXED_SCALE,
  POMODORO_BUNNY_IMG_CLASS,
  POMODORO_BUNNY_ORIGIN_CLASS,
  pomodoroBunnyHitboxRem,
  type PomodoroCompanionPosition,
} from "@/lib/pomodoroCompanionLayout";

type Props = {
  active: boolean;
  victoryTrigger?: number;
};

export default function PomodoroBunnyCompanion({ active, victoryTrigger = 0 }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [victory, setVictory] = useState(false);
  const [bunnyPos, setBunnyPos] = useState<PomodoroCompanionPosition | null>(null);
  const [bubblePos, setBubblePos] = useState<PomodoroCompanionPosition | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideBubbleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIndexRef = useRef(0);
  const lockedBunnyPosRef = useRef<PomodoroCompanionPosition | null>(null);
  const lockedBubblePosRef = useRef<PomodoroCompanionPosition | null>(null);

  useEffect(() => {
    if (!active) {
      setLayoutReady(false);
      setBunnyPos(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    const hitboxRem = pomodoroBunnyHitboxRem(POMODORO_BUNNY_FIXED_SCALE);
    const savedBunny = normalizePomodoroSavedPosition(getPomodoroBunnyPosition(), width, height);
    if (savedBunny) lockedBunnyPosRef.current = savedBunny;
    const bunny = lockedBunnyPosRef.current ?? savedBunny;
    const bunnyAnchor = bunny ?? defaultPomodoroBunnyPosition(width, hitboxRem);
    const savedBubble = normalizePomodoroSavedPosition(getPomodoroBubblePosition(), width, height);
    if (savedBubble) lockedBubblePosRef.current = savedBubble;
    const bubble = applyPomodoroBubbleOffset(
      lockedBubblePosRef.current ??
        savedBubble ??
        defaultPomodoroBubblePosition(bunnyAnchor, hitboxRem, width, height),
    );
    setBunnyPos(bunny);
    setBubblePos(bubble);
    setLayoutReady(true);
  }, [active]);

  const showEncouragement = useCallback(() => {
    const msg = pickEncouragementMessage();
    messageIndexRef.current += 1;
    setMessage(msg);
    playEncouragementChime();

    if (hideBubbleRef.current) clearTimeout(hideBubbleRef.current);
    hideBubbleRef.current = setTimeout(() => setMessage(null), 5000);
  }, []);

  const scheduleNext = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!active) return;
    timeoutRef.current = setTimeout(() => {
      showEncouragement();
      scheduleNext();
    }, randomEncouragementIntervalMs());
  }, [active, showEncouragement]);

  useEffect(() => {
    if (!active) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideBubbleRef.current) clearTimeout(hideBubbleRef.current);
      setMessage(null);
      return;
    }
    scheduleNext();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideBubbleRef.current) clearTimeout(hideBubbleRef.current);
    };
  }, [active, scheduleNext]);

  useEffect(() => {
    if (!victoryTrigger) return;
    setVictory(true);
    const t = setTimeout(() => setVictory(false), 1400);
    return () => clearTimeout(t);
  }, [victoryTrigger]);

  const hitboxRem = pomodoroBunnyHitboxRem(POMODORO_BUNNY_FIXED_SCALE);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] pointer-events-none overflow-visible"
      aria-live="polite"
    >
      {layoutReady && (
        <>
          <div
            data-bunny-wrapper
            className={`${bunnyPos ? "absolute" : POMODORO_BUNNY_DEFAULT_CLASS} z-[61] pointer-events-none`}
            style={{
              ...(bunnyPos ? { left: bunnyPos.left, bottom: bunnyPos.bottom } : {}),
              width: `${hitboxRem}rem`,
              height: `${hitboxRem}rem`,
            }}
          >
            <button
              type="button"
              onClick={showEncouragement}
              className="pointer-events-auto absolute inset-0 cursor-pointer touch-none select-none rounded-none border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Tap TimeBunny for encouragement"
            >
              <div
                className={`absolute bottom-0 right-0 ${POMODORO_BUNNY_ORIGIN_CLASS}`}
                style={{ transform: `scale(${POMODORO_BUNNY_FIXED_SCALE})` }}
              >
                <motion.img
                  src={bunnyMascot}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className={`${POMODORO_BUNNY_IMG_CLASS} object-contain drop-shadow-lg pixel-img ${
                    victory ? "animate-bunny-victory" : "animate-bunny-pomodoro-idle"
                  }`}
                  animate={victory ? { scale: [1, 1.15, 1.05, 1] } : { scale: 1 }}
                  transition={{ duration: 0.9 }}
                />
              </div>
            </button>
          </div>

          <div
            data-speech-bubble
            className={`${POMODORO_BUBBLE_WIDTH_CLASS} pointer-events-none absolute z-[62]`}
            style={{ left: bubblePos?.left, bottom: bubblePos?.bottom }}
          >
            <AnimatePresence>
              {message && (
                <motion.div
                  key={messageIndexRef.current}
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 4 }}
                  transition={{ duration: 0.25 }}
                >
                  <div
                    className="relative bg-white px-4 py-3 shadow-lg"
                    style={{
                      borderRadius: "50%",
                      minHeight: "4.5rem",
                      border: "3px solid hsl(280 40% 20%)",
                      boxShadow: "3px 3px 0 hsl(280 40% 20%)",
                    }}
                  >
                    <p
                      className="text-xs sm:text-sm text-center leading-snug"
                      style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}
                    >
                      {message}
                    </p>
                  </div>
                  <div className="relative h-6 w-full">
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 rounded-full"
                      style={{ borderColor: "hsl(280 40% 20%)" }}
                    />
                    <div
                      className="absolute top-2 left-[54%] w-2 h-2 bg-white border-2 rounded-full"
                      style={{ borderColor: "hsl(280 40% 20%)" }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
