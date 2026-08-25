import type { VibeCheckEntry } from "@/hooks/useSchedulePersistence";

export type VibeStressSignals = {
  detected: boolean;
  matchedWords: string[];
  criticalOnly: boolean;
};

type VibeInput = Pick<
  VibeCheckEntry,
  "mood" | "energy" | "needBreak" | "adjustSchedule" | "notes"
>;

const STRONG_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\boverwhelmed\b/i, label: "overwhelmed" },
  { pattern: /\bstressed\b/i, label: "stressed" },
  { pattern: /\bstress(?:ed|ful)?\b/i, label: "stress" },
  { pattern: /\banxious\b/i, label: "anxious" },
  { pattern: /\banxiety\b/i, label: "anxiety" },
  { pattern: /\bexhausted\b/i, label: "exhausted" },
  { pattern: /\bburn(?:t|ned)?\s*out\b/i, label: "burnout" },
  { pattern: /\btoo much\b/i, label: "too much" },
  { pattern: /\bcan'?t(?:\s+\w+){0,3}\s+cope\b/i, label: "can't cope" },
  { pattern: /\bdrowning\b/i, label: "drowning" },
];

const MEDIUM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\btired\b/i, label: "tired" },
  { pattern: /\bweary\b/i, label: "weary" },
  { pattern: /\bdrained\b/i, label: "drained" },
  { pattern: /\bfatigued\b/i, label: "fatigued" },
  { pattern: /\bwiped\b/i, label: "wiped" },
  { pattern: /\bdepleted\b/i, label: "depleted" },
];

const REALLY_INTENSIFIER =
  /\breally\s+(tired|stressed|overwhelmed|exhausted|anxious|bad|rough|hard|busy)\b/i;

/** Scan vibe-check answers for stress/trigger language and low-capacity signals. */
export const detectVibeStressSignals = (input: VibeInput): VibeStressSignals => {
  const text = input.notes.trim();
  const matched = new Set<string>();

  for (const { pattern, label } of STRONG_PATTERNS) {
    if (pattern.test(text)) matched.add(label);
  }
  for (const { pattern, label } of MEDIUM_PATTERNS) {
    if (pattern.test(text)) matched.add(label);
  }
  const reallyMatch = text.match(REALLY_INTENSIFIER);
  if (reallyMatch) {
    matched.add("really");
    matched.add(reallyMatch[1].toLowerCase());
  }

  const moodStress = input.mood === "struggling";
  const energyStress = input.energy === "low";
  if (moodStress) matched.add("low mood");
  if (energyStress) matched.add("low energy");
  if (input.needBreak) matched.add("needs break");

  const detected =
    matched.size > 0 ||
    moodStress ||
    energyStress ||
    input.adjustSchedule === "lighten";

  return {
    detected,
    matchedWords: [...matched],
    criticalOnly:
      detected &&
      (matched.has("overwhelmed") ||
        matched.has("stressed") ||
        matched.has("stress") ||
        matched.has("too much") ||
        matched.has("can't cope") ||
        matched.has("drowning") ||
        matched.has("burnout") ||
        matched.has("really") ||
        matched.has("exhausted")),
  };
};

export const buildStressSchedulePrompt = (signals: VibeStressSignals): string => {
  if (!signals.detected) return "";

  const words = signals.matchedWords.length > 0 ? signals.matchedWords.join(", ") : "general stress";

  if (signals.criticalOnly) {
    return `\n\n⚠️ STRESS / TRIGGER SIGNALS (${words}):
EASY WORKLOAD MODE — prioritize ONLY:
1. [FIXED] calendar blocks and imminent deadlines (next 24h)
2. Tasks tagged critical / high priority / 🎯 goals IF energy allows (short blocks only)
DEFER (keep on the schedule later today — do not delete): moderate/low priority, optional tasks, nice-to-haves.
Add extra breaks. Shorter blocks (15–25 min). Be protective, not ambitious.
Keep every original task that already happened today unchanged.`;
  }

  return `\n\n⚠️ STRESS SIGNALS (${words}): Ease pacing — fewer tasks, more breaks, gentler transitions.`;
};

export const CRITICAL_ONLY_COMFORT_MESSAGES = [
  "I trimmed today down to the essentials. You don't have to carry everything at once.",
  "Critical-only mode isn't giving up — it's choosing what matters most. One step at a time.",
  "I'm here with you. Let's focus on what truly needs doing and let the rest wait.",
  "Rough days happen. This lighter plan is me looking out for you — you can do this.",
  "Progress isn't always loud. Showing up for even one important thing today still counts.",
  "Take it gently. I built in breathing room — rest is part of the plan, not something you earn.",
  "You said you're overwhelmed, so I'm protecting your energy. That's strength, not weakness.",
  "Small wins stack up. Finish what's critical, and be kind to yourself about the rest.",
];

export const LANDING_BUNNY_MESSAGES = [
  "Whenever you're ready, tap start and we'll build today's schedule together.",
  "We'll look at your calendar, your energy, and what actually matters today.",
  "No need to hold it all in your head — that's what I'm here for.",
  "One step at a time. We'll figure out the rest as we go.",
];

export const getLandingBunnyMessages = (
  comfortMode: "critical_only" | null,
): readonly string[] =>
  comfortMode === "critical_only" ? CRITICAL_ONLY_COMFORT_MESSAGES : LANDING_BUNNY_MESSAGES;

export const pickCriticalOnlyComfortMessage = (): string =>
  CRITICAL_ONLY_COMFORT_MESSAGES[
    Math.floor(Math.random() * CRITICAL_ONLY_COMFORT_MESSAGES.length)
  ];
