import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { VibeCheckEntry } from "@/hooks/useSchedulePersistence";
import type { ScheduleItem } from "@/types/schedule";

export type ScheduleGenerationContext = {
  calendarAnalysis?: AnalyzedTask[];
  vibeChecks?: VibeCheckEntry[];
  optimizeMode?: "default" | "lighten" | "reschedule" | "critical_only";
  existingSchedule?: ScheduleItem[];
};

import { localDateString } from "@/lib/localTime";

const todayStr = () => localDateString();

/** Format neurosymbolic calendar analysis for the schedule optimizer. */
export const buildCalendarAnalysisPrompt = (tasks: AnalyzedTask[]): string => {
  if (tasks.length === 0) return "";

  const today = todayStr();
  const lines = tasks.map((t) => {
    const time =
      t.startTime && t.endTime
        ? `${t.startTime}–${t.endTime}`
        : t.startTime
          ? t.startTime
          : t.date ?? "unscheduled";
    const isToday = t.date === today;
    const fixed = isToday && t.startTime ? " [FIXED TODAY — immutable wall]" : "";
    const prep =
      t.prep_milestones.length > 0 ? `\n    Prep: ${t.prep_milestones.join("; ")}` : "";
    return `- ${t.title}${fixed} (${time}, ${t.final_category}, ${t.final_importance} importance)
    Start prepping by: ${t.recommended_start_date ?? "ASAP"} (${t.lead_days}d lead)${prep}
    Reasoning: ${t.rationale}`;
  });

  return `\n\n📅 NEUROSYMBOLIC CALENDAR ANALYSIS — USE FOR OPTIMIZATION:
${lines.join("\n")}

Calendar optimization rules (from symbolic + neural fusion):
- Events marked [FIXED TODAY] are immovable — copy exact start/end times into output.
- Schedule prep work for critical/major items BEFORE their event date using lead_days and prep milestones.
- Weight scheduling priority: critical > major > moderate > minor.
- If prep start date is today or past, block time TODAY for prep milestones even around fixed events.`;
};

export const buildVibeChecksPrompt = (checks: VibeCheckEntry[]): string => {
  if (checks.length === 0) return "";

  const recent = [...checks].slice(-5);
  const lines = recent.map((v) => {
    const when = new Date(v.at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `- ${when}: mood=${v.mood}, energy=${v.energy}, adjust=${v.adjustSchedule}${v.needBreak ? ", needs break" : ""}${v.notes ? ` — "${v.notes}"` : ""}`;
  });

  const latest = recent[recent.length - 1];
  let adjustment = "";
  if (latest.adjustSchedule === "lighten") {
    adjustment =
      "\nLATEST VIBE REQUEST: LIGHTEN — defer non-urgent tasks, add breaks, shorten blocks, protect wellbeing.";
  } else if (latest.adjustSchedule === "reschedule") {
    adjustment =
      "\nLATEST VIBE REQUEST: RESCHEDULE — rebuild remaining day from current time with realistic pacing.";
  }

  const stressNote =
    latest.notes &&
    /\b(overwhelmed|stressed|tired|exhausted|anxious|really|too much)\b/i.test(latest.notes)
      ? "\nNotes contain stress language — use easy workload; critical tasks only unless [FIXED]."
      : latest.mood === "struggling" || latest.energy === "low"
        ? "\nLow mood/energy — easy workload; critical + fixed blocks only."
        : "";

  return `\n\n💭 VIBE CHECK HISTORY — ADAPT SCHEDULE TO USER STATE:
${lines.join("\n")}${adjustment}${stressNote}

Vibe-based rules:
- struggling + low energy → fewer/deferred tasks, more breaks, no guilt-inducing density.
- great + high energy → can front-load harder work but still respect deadlines.
- needBreak=true → insert a 15–20 min break within the next 90 minutes.`;
};

export const buildExistingSchedulePrompt = (
  schedule: ScheduleItem[],
  mode: ScheduleGenerationContext["optimizeMode"] = "default",
): string => {
  if (schedule.length === 0) return "";

  const lines = schedule
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((s) => `- ${s.time}${s.endTime ? `–${s.endTime}` : ""}: ${s.title}`);

  const modeNote =
    mode === "lighten"
      ? "\nOptimize by LIGHTENING this schedule — keep deadlines and [FIXED] items, trim or defer the rest."
      : mode === "reschedule"
        ? "\nRebuild the schedule from now forward using this as context for what still matters."
        : mode === "critical_only"
          ? "\nCRITICAL ONLY — keep [FIXED] blocks and critical/deadline tasks; defer everything else."
          : "";

  return `\n\n📋 CURRENT SCHEDULE (reference)${modeNote}:
${lines.join("\n")}`;
};

/** Today's calendar events as fixed blocks from neurosymbolic analysis. */
export const getTodayFixedEventsFromAnalysis = (tasks: AnalyzedTask[]): AnalyzedTask[] => {
  const today = todayStr();
  return tasks.filter((t) => t.date === today && Boolean(t.startTime));
};
