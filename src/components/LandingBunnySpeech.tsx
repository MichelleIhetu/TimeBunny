import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import bunnyMascot from "@/assets/bunny-mascot.png";
import { getLandingBunnyMessages } from "@/lib/vibeStressDetection";
import { usePlatform } from "@/hooks/usePlatform";
import { cn } from "@/lib/utils";

type Props = {
  comfortMode?: "critical_only" | null;
  /** Auto-show first message on mount (e.g. critical-only comfort). */
  autoShow?: boolean;
  /** default = soft bottom-right; flush-right = tucked to the right edge, clears mobile tab bar */
  placement?: "default" | "flush-right";
  className?: string;
  imageClassName?: string;
  bubbleClassName?: string;
};

const FLUSH_RIGHT_BUBBLE =
  "absolute -top-4 right-[62%] sm:right-[68%] w-64 sm:w-72 md:w-80 z-20 pointer-events-none";

export default function LandingBunnySpeech({
  comfortMode = null,
  autoShow = false,
  placement = "default",
  className = "fixed bottom-4 right-0 sm:right-4 z-50",
  imageClassName = "w-72 sm:w-96 md:w-[28rem] object-contain drop-shadow-xl transition-transform duration-200 hover:scale-105 active:scale-95 pixel-img",
  bubbleClassName = "absolute -top-4 right-[55%] sm:right-[58%] w-64 sm:w-72 md:w-80 z-20 pointer-events-none",
}: Props) {
  const { useMobileChrome } = usePlatform();
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messageIndexRef = useRef(0);
  const typeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoShownRef = useRef(false);

  const typeMessage = useCallback((msg: string) => {
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    if (!msg) {
      setTypedText("");
      setIsTyping(false);
      return;
    }
    setIsTyping(true);
    let i = 1;
    setTypedText(msg.slice(0, 1));
    if (msg.length <= 1) {
      setIsTyping(false);
      return;
    }
    typeIntervalRef.current = setInterval(() => {
      i++;
      setTypedText(msg.slice(0, i));
      if (i >= msg.length) {
        if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
        setIsTyping(false);
      }
    }, 40);
  }, []);

  const showMessage = useCallback(
    (index: number) => {
      const messages = getLandingBunnyMessages(comfortMode);
      if (messages.length === 0) return;
      const safeIndex = ((index % messages.length) + messages.length) % messages.length;
      messageIndexRef.current = safeIndex;
      setShowSpeechBubble(true);
      typeMessage(messages[safeIndex]);
    },
    [comfortMode, typeMessage],
  );

  const handleClick = useCallback(() => {
    if (isTyping) return;
    const messages = getLandingBunnyMessages(comfortMode);
    if (messages.length === 0) return;
    if (!showSpeechBubble) {
      showMessage(0);
      return;
    }
    showMessage(messageIndexRef.current + 1);
  }, [comfortMode, isTyping, showMessage, showSpeechBubble]);

  useEffect(() => {
    if (!autoShow || autoShownRef.current) return;
    autoShownRef.current = true;
    messageIndexRef.current = 0;
    showMessage(0);
  }, [autoShow, showMessage]);

  useEffect(() => {
    autoShownRef.current = false;
  }, [comfortMode, autoShow]);

  useEffect(
    () => () => {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    },
    [],
  );

  const flushRightStyle: CSSProperties =
    placement === "flush-right"
      ? {
          position: "fixed",
          right: 0,
          bottom: useMobileChrome
            ? "calc(4.5rem + env(safe-area-inset-bottom, 0px))"
            : 0,
          zIndex: 40,
          transform: "translateX(14%)",
          pointerEvents: "none",
        }
      : {};

  const resolvedBubbleClass =
    placement === "flush-right" ? FLUSH_RIGHT_BUBBLE : bubbleClassName;

  return (
    <div
      className={cn(placement === "flush-right" ? undefined : className, placement === "flush-right" && "[&_button]:pointer-events-auto")}
      style={flushRightStyle}
    >
      <button
        type="button"
        aria-label="Talk to TimeBunny"
        className="relative cursor-pointer bg-transparent border-0 p-0"
        onClick={handleClick}
        style={placement === "flush-right" ? { pointerEvents: "auto" } : undefined}
      >
        <AnimatePresence>
          {showSpeechBubble && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className={resolvedBubbleClass}
            >
              <div
                className="relative bg-white p-5 shadow-xl"
                style={{
                  borderRadius: "50%",
                  minHeight: "5.5rem",
                  border: "3px solid hsl(280 40% 20%)",
                  outline: "2px solid hsl(280 40% 20%)",
                  outlineOffset: "3px",
                  boxShadow: "4px 4px 0px hsl(280 40% 20%)",
                }}
              >
                <p
                  className="text-sm text-center leading-relaxed"
                  style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}
                >
                  {typedText}
                  {isTyping && (
                    <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                  )}
                </p>
              </div>
              <div className="relative w-full h-12 pointer-events-none">
                <div
                  className="absolute top-0 w-4 h-4 bg-white border-2 rounded-full left-[72%]"
                  style={{ borderColor: "hsl(280 40% 20%)" }}
                />
                <div
                  className="absolute top-4 w-2.5 h-2.5 bg-white border-2 rounded-full left-[82%]"
                  style={{ borderColor: "hsl(280 40% 20%)" }}
                />
                <div
                  className="absolute top-8 w-1.5 h-1.5 bg-white border-2 rounded-full left-[90%]"
                  style={{ borderColor: "hsl(280 40% 20%)" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <img src={bunnyMascot} alt="TimeBunny mascot" className={imageClassName} draggable={false} />
      </button>
    </div>
  );
}
