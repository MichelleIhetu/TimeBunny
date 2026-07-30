export const ENERGY_STRESS_SPEECH_BUBBLE_POS_KEY = "timebunny_energy_stress_speech_bubble_pos";

export type SpeechBubblePosition = {
  left: number;
  bottom: number;
};

/** Saved placement from drag tuning — applied as fixed position when present. */
export function loadEnergyStressSpeechBubblePosition(): SpeechBubblePosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENERGY_STRESS_SPEECH_BUBBLE_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SpeechBubblePosition;
    if (typeof parsed.left === "number" && typeof parsed.bottom === "number") {
      return parsed;
    }
  } catch {}
  return null;
}
