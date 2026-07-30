import { useState, useMemo } from "react";
import SEO from "@/components/SEO";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smile, Meh, Frown, Battery, BatteryLow, BatteryMedium,
  Coffee, CheckCircle2, ArrowRight, ArrowLeft, Sparkles,
  RefreshCw, CalendarClock, Zap
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import bunnyMascot from "@/assets/bunny-mascot.png";
import { useAuth } from "@/hooks/useAuth";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import { detectVibeStressSignals } from "@/lib/vibeStressDetection";

export interface VibeCheckResult {
  mood: "great" | "okay" | "struggling";
  energy: "high" | "medium" | "low";
  needBreak: boolean;
  adjustSchedule: "keep" | "lighten" | "reschedule";
  notes: string;
  stressSignals?: {
    detected: boolean;
    matchedWords: string[];
    criticalOnly: boolean;
  };
}

type Step = "mood" | "energy" | "break" | "adjust" | "done";
const stepOrder: Step[] = ["mood", "energy", "break", "adjust", "done"];

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

// Palette aligned with active task timer & Goals page
const COLORS = {
  bg: "hsl(300 50% 88%)",
  card: "hsl(40 60% 95%)",
  border: "hsl(280 30% 60%)",
  borderSoft: "hsl(280 30% 80%)",
  ink: "hsl(280 40% 22%)",
  inkSoft: "hsl(280 30% 45%)",
  accent: "hsl(280 55% 55%)",
  green: "hsl(150 55% 55%)",
  yellow: "hsl(45 90% 60%)",
  red: "hsl(350 70% 65%)",
  blue: "hsl(210 80% 60%)",
};

const VibeCheck = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { appendVibeCheck } = useSchedulePersistence(user?.id);

  const [step, setStep] = useState<Step>("mood");
  const [mood, setMood] = useState<VibeCheckResult["mood"] | null>(null);
  const [energy, setEnergy] = useState<VibeCheckResult["energy"] | null>(null);
  const [needBreak, setNeedBreak] = useState(false);
  const [adjustSchedule, setAdjustSchedule] = useState<VibeCheckResult["adjustSchedule"] | null>(null);
  const [notes, setNotes] = useState("");

  const pendingStress = useMemo(() => {
    if (!mood || !energy || !adjustSchedule) return null;
    return detectVibeStressSignals({ mood, energy, needBreak, adjustSchedule, notes });
  }, [mood, energy, needBreak, adjustSchedule, notes]);

  const currentIndex = stepOrder.indexOf(step);
  const progress = ((currentIndex + 1) / stepOrder.length) * 100;

  const canProceed = () => {
    if (step === "mood") return mood !== null;
    if (step === "energy") return energy !== null;
    if (step === "adjust") return adjustSchedule !== null;
    return true;
  };

  const goNext = () => {
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
  };
  const goBack = () => {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  };

  const getBunnyMessage = () => {
    switch (step) {
      case "mood": return "Hey! How are you vibing right now?";
      case "energy": return "And your energy levels?";
      case "break": return "Do you need some time to recharge?";
      case "adjust": return "Should we change up your schedule?";
      case "done":
        if (mood === "struggling") return "Hang in there! Let's make things easier 💪";
        if (mood === "great") return "You're on fire! Keep that momentum! 🔥";
        return "Steady progress is still progress! ✨";
    }
  };

  const getBunnyMood = () => {
    if (step === "done" && mood === "great") return "celebrating" as const;
    if (step === "done" && mood === "struggling") return "encouraging" as const;
    return "happy" as const;
  };

  const handleFinish = async () => {
    const base = {
      mood: mood!,
      energy: energy!,
      needBreak,
      adjustSchedule: adjustSchedule!,
      notes,
    };
    const stressSignals = detectVibeStressSignals(base);
    const result: VibeCheckResult = { ...base, stressSignals };

    try {
      await appendVibeCheck({ at: new Date().toISOString(), ...result });
    } catch (e) {
      console.error(e);
    }

    navigate("/", {
      state: {
        vibeCheckResult: result,
        openScheduleView: true,
      },
    });
  };

  // Pixel button — chunky shadow like Goals page
  const PixelBtn = ({
    selected, onClick, color, children,
  }: { selected: boolean; onClick: () => void; color: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="p-4 rounded-xl transition-all flex flex-col items-center gap-2 active:translate-y-0.5"
      style={{
        background: selected ? color : "white",
        border: `3px solid ${selected ? color : COLORS.borderSoft}`,
        boxShadow: selected
          ? `4px 4px 0px ${COLORS.border}`
          : `4px 4px 0px ${COLORS.borderSoft}`,
        color: selected ? "white" : COLORS.ink,
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: COLORS.bg }}
    >
      <SEO title="Vibe Check — TimeBunny" description="Hourly motivation check-in that adjusts the rest of your TimeBunny schedule." path="/vibe-check" />

      {/* Decorative clock tick marks like the active timer scene */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-50">
        <div className="relative" style={{ width: "min(140vw, 140vh)", height: "min(140vw, 140vh)" }}>
          {Array.from({ length: 60 }).map((_, i) => {
            const isHour = i % 5 === 0;
            return (
              <div
                key={i}
                className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom"
                style={{ height: "50%", transform: `translateX(-50%) rotate(${i * 6}deg)` }}
              >
                <div
                  className="rounded-full mx-auto"
                  style={{
                    width: isHour ? "5px" : "2px",
                    height: isHour ? "20px" : "10px",
                    background: isHour ? "hsl(280 40% 50% / 0.4)" : "hsl(280 40% 50% / 0.2)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto">
        {/* Pixel header */}
        <div className="text-center mb-4">
          <h1 style={PIXEL} className="text-[14px] mb-2" >
            <span style={{ color: COLORS.ink }}>VIBE</span>{" "}
            <span style={{ color: COLORS.accent }}>CHECK</span>
          </h1>
          <p style={VT} className="text-lg" >
            <span style={{ color: COLORS.inkSoft }}>STEP {currentIndex + 1} / {stepOrder.length}</span>
          </p>
        </div>

        {/* Pixel progress bar */}
        <div className="mb-5 px-1">
          <div
            className="h-4 w-full p-0.5"
            style={{
              background: "white",
              border: `2px solid ${COLORS.border}`,
              boxShadow: `3px 3px 0px ${COLORS.border}`,
            }}
          >
            <motion.div
              className="h-full"
              style={{ background: COLORS.accent }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Card */}
        <motion.div
          className="overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: COLORS.card,
            border: `4px solid ${COLORS.border}`,
            borderRadius: "1.25rem",
            boxShadow: `8px 8px 0px ${COLORS.border}`,
          }}
        >
          {/* Bunny header */}
          <div className="pt-6 pb-3 flex flex-col items-center">
            <img src={bunnyMascot} alt="Bunny mascot" className="w-32 h-32 object-contain pixel-img" draggable={false} />
          </div>

          {/* Step content */}
          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              {step === "mood" && (
                <motion.div key="mood" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                  <h2 style={PIXEL} className="text-center text-[11px]" >
                    <span style={{ color: COLORS.ink }}>HOW'S YOUR MOTIVATION?</span>
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: "great" as const, icon: Smile, label: "Locked In", color: COLORS.green },
                      { value: "okay" as const, icon: Meh, label: "Mid Vibes", color: COLORS.yellow },
                      { value: "struggling" as const, icon: Frown, label: "Not It", color: COLORS.red },
                    ]).map(({ value, icon: Icon, label, color }) => (
                      <PixelBtn key={value} selected={mood === value} onClick={() => setMood(value)} color={color}>
                        <Icon className="w-9 h-9" />
                        <p style={VT} className="text-base leading-none">{label}</p>
                      </PixelBtn>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === "energy" && (
                <motion.div key="energy" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                  <h2 style={PIXEL} className="text-center text-[11px]" >
                    <span style={{ color: COLORS.ink }}>ENERGY LEVEL?</span>
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: "high" as const, icon: Battery, label: "Full Charge", color: COLORS.green },
                      { value: "medium" as const, icon: BatteryMedium, label: "Cruising", color: COLORS.yellow },
                      { value: "low" as const, icon: BatteryLow, label: "Low Bat", color: COLORS.red },
                    ]).map(({ value, icon: Icon, label, color }) => (
                      <PixelBtn key={value} selected={energy === value} onClick={() => setEnergy(value)} color={color}>
                        <Icon className="w-9 h-9" />
                        <p style={VT} className="text-base leading-none">{label}</p>
                      </PixelBtn>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === "break" && (
                <motion.div key="break" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                  <h2 style={PIXEL} className="text-center text-[11px]" >
                    <span style={{ color: COLORS.ink }}>NEED A BREAK?</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <PixelBtn selected={!needBreak} onClick={() => setNeedBreak(false)} color={COLORS.blue}>
                      <Zap className="w-9 h-9" />
                      <p style={VT} className="text-base leading-none">Nah, I'm Good</p>
                      <p style={VT} className="text-sm opacity-75">Keep Grinding</p>
                    </PixelBtn>
                    <PixelBtn selected={needBreak} onClick={() => setNeedBreak(true)} color={COLORS.green}>
                      <Coffee className="w-9 h-9" />
                      <p style={VT} className="text-base leading-none">Yes Please</p>
                      <p style={VT} className="text-sm opacity-75">Add A Break</p>
                    </PixelBtn>
                  </div>
                </motion.div>
              )}

              {step === "adjust" && (
                <motion.div key="adjust" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                  <h2 style={PIXEL} className="text-center text-[11px]" >
                    <span style={{ color: COLORS.ink }}>ADJUST SCHEDULE?</span>
                  </h2>
                  <div className="space-y-3">
                    {([
                      { value: "keep" as const, icon: CheckCircle2, title: "KEEP IT AS IS", desc: "I'm on track, no changes" },
                      { value: "lighten" as const, icon: CalendarClock, title: "LIGHTEN THE LOAD", desc: "Push non-urgent tasks back" },
                      { value: "reschedule" as const, icon: RefreshCw, title: "REBUILD IT", desc: "Reschedule from now" },
                    ]).map(({ value, icon: Icon, title, desc }) => {
                      const selected = adjustSchedule === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setAdjustSchedule(value)}
                          className="w-full p-3 rounded-xl transition-all flex items-center gap-3 text-left active:translate-y-0.5"
                          style={{
                            background: selected ? COLORS.accent : "white",
                            border: `3px solid ${selected ? COLORS.accent : COLORS.borderSoft}`,
                            boxShadow: `4px 4px 0px ${selected ? COLORS.border : COLORS.borderSoft}`,
                            color: selected ? "white" : COLORS.ink,
                          }}
                        >
                          <Icon className="w-6 h-6 shrink-0" />
                          <div className="min-w-0">
                            <p style={PIXEL} className="text-[9px] leading-tight">{title}</p>
                            <p style={VT} className="text-base leading-tight opacity-90">{desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <p style={VT} className="text-base mb-1" >
                      <span style={{ color: COLORS.inkSoft }}>ANYTHING ELSE? (OPTIONAL)</span>
                    </p>
                    <Textarea
                      placeholder="Spill the tea..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[70px] resize-none"
                      style={{
                        ...VT,
                        fontSize: "1.05rem",
                        background: "white",
                        border: `3px solid ${COLORS.borderSoft}`,
                        boxShadow: `4px 4px 0px ${COLORS.borderSoft}`,
                        color: COLORS.ink,
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {step === "done" && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 text-center">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{
                      background: "white",
                      border: `3px solid ${COLORS.accent}`,
                      boxShadow: `4px 4px 0px ${COLORS.accent}`,
                    }}
                  >
                    <Sparkles className="w-4 h-4" style={{ color: COLORS.accent }} />
                    <span style={PIXEL} className="text-[9px]">
                      <span style={{ color: COLORS.ink }}>VIBE CHECK COMPLETE!</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 py-2">
                    {[
                      { label: "MOOD", val: mood === "great" ? "Locked In" : mood === "okay" ? "Mid Vibes" : "Not It" },
                      { label: "ENERGY", val: energy === "high" ? "Full Charge" : energy === "medium" ? "Cruising" : "Low Bat" },
                      { label: "BREAK", val: needBreak ? "Yes Please" : "Nah, Good" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="p-3 rounded-xl"
                        style={{
                          background: "white",
                          border: `3px solid ${COLORS.borderSoft}`,
                          boxShadow: `4px 4px 0px ${COLORS.borderSoft}`,
                        }}
                      >
                        <p style={PIXEL} className="text-[8px]">
                          <span style={{ color: COLORS.inkSoft }}>{s.label}</span>
                        </p>
                        <p style={VT} className="text-base mt-1" >{s.val}</p>
                      </div>
                    ))}
                  </div>

                  {pendingStress?.detected && (
                    <p style={VT} className="text-base">
                      <span style={{ color: COLORS.red }}>
                        We'll keep today to the essentials — only what truly needs doing.
                      </span>
                    </p>
                  )}

                  {adjustSchedule !== "keep" && (
                    <p style={VT} className="text-base">
                      <span style={{ color: COLORS.inkSoft }}>
                        {adjustSchedule === "lighten"
                          ? "We'll push non-urgent tasks out to lighten your load."
                          : "We'll rebuild your schedule from now — hang tight!"}
                      </span>
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="px-6 pb-6 flex gap-3 items-center">
            {step !== "mood" && step !== "done" && (
              <button
                onClick={goBack}
                className="px-4 py-2.5 rounded-full transition-all flex items-center gap-2 active:translate-y-0.5"
                style={{
                  background: "white",
                  border: `3px solid ${COLORS.borderSoft}`,
                  boxShadow: `4px 4px 0px ${COLORS.borderSoft}`,
                  color: COLORS.ink,
                  ...PIXEL,
                  fontSize: "9px",
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> BACK
              </button>
            )}
            <div className="flex-1" />
            {step !== "done" ? (
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className="px-5 py-2.5 rounded-full transition-all flex items-center gap-2 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: COLORS.accent,
                  border: `3px solid ${COLORS.border}`,
                  boxShadow: `4px 4px 0px ${COLORS.border}`,
                  color: "white",
                  ...PIXEL,
                  fontSize: "9px",
                }}
              >
                NEXT <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="w-full px-5 py-3 rounded-full transition-all flex items-center justify-center gap-2 active:translate-y-0.5"
                style={{
                  background: COLORS.green,
                  border: `3px solid ${COLORS.border}`,
                  boxShadow: `4px 4px 0px ${COLORS.border}`,
                  color: "white",
                  ...PIXEL,
                  fontSize: "10px",
                }}
              >
                <Sparkles className="w-4 h-4" />
                {adjustSchedule === "keep" ? "SEE UPDATED SCHEDULE" : "UPDATE SCHEDULE"}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VibeCheck;
