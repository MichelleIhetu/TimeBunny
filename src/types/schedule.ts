export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type EnergyLevel = "motivated" | "unmotivated";
export type StressLevel = "low" | "medium" | "high";

export const DEFAULT_SCHEDULE_SUIT: Suit = "clubs";

export interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  endTime?: string;
  description?: string;
  /** Legacy metadata kept for saved schedules; not shown in the UI. */
  suit?: Suit;
  /** Links this block to a long-term goal for auto progress logging */
  goalId?: string;
}

export interface UserSettings {
  energyLevel: EnergyLevel;
  stressLevel: StressLevel;
  wakeTime: string;
  bedTime: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
