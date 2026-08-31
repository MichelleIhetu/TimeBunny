import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { VibeCheckEntry } from "@/hooks/useSchedulePersistence";
import type { ScheduleItem } from "@/types/schedule";
import { localDateString } from "@/lib/localTime";
import { TIME_OF_DAY_TITLE_RULES } from "@/lib/scheduleTimeOfDay";
import { PAST_DUE_SCHEDULE_RULES } from "@/lib/schedulePastDue";

export { TIME_OF_DAY_TITLE_RULES } from "@/lib/scheduleTimeOfDay";
export { PAST_DUE_SCHEDULE_RULES } from "@/lib/schedulePastDue";

export type ScheduleGenerationContext = {
  calendarAnalysis?: AnalyzedTask[];
  vibeChecks?: VibeCheckEntry[];
  optimizeMode?: "default" | "lighten" | "reschedule" | "critical_only";
  existingSchedule?: ScheduleItem[];
  journalText?: string;
};

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
- Schedule prep work for critical/major UPCOMING items BEFORE their event date using lead_days and prep milestones.
- Weight scheduling priority: critical > major > moderate > minor.
- If an upcoming event's prep start date is today or past, block time TODAY for those prep milestones.
- Never invent prep for events that already happened.
${TIME_OF_DAY_TITLE_RULES}
${PAST_DUE_SCHEDULE_RULES}`;
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
      "\nLATEST VIBE REQUEST: LIGHTEN — keep every original task. Defer non-urgent work to later today, add breaks, shorten blocks. Do not delete tasks.";
  } else if (latest.adjustSchedule === "reschedule") {
    adjustment =
      "\nLATEST VIBE REQUEST: RESCHEDULE — adjust remaining day from current time. Keep earlier tasks unchanged.";
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
- needBreak=true → insert a 15–20 min break now (or within the next 30 minutes). Keep the rest of the schedule.`;
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
      ? "\nLIGHTEN this schedule — keep every original task. Move non-urgent items later or shorten them. Do not delete tasks. Copy every item that already started today unchanged."
      : mode === "reschedule"
        ? "\nAdjust remaining items from now forward. Copy every item that already started today UNCHANGED (same title, start, end). Do not erase earlier tasks."
        : mode === "critical_only"
          ? "\nCRITICAL ONLY for remaining time — keep [FIXED] blocks and critical/deadline tasks up front; move everything else later today. Never delete original tasks. Copy earlier items unchanged."
          : "\nKeep earlier items unchanged. Only adjust remaining items from now forward.";

  return `\n\n📋 CURRENT SCHEDULE (must preserve earlier items)${modeNote}:
${lines.join("\n")}

Preservation rules:
- Include ALL items that start before now exactly as listed.
- needBreak means INSERT a break — do not rebuild the day from scratch.
- If you move a task, keep it on the schedule at a later time.
- Respect the day's story: meals, classes, wind-down, and bedtime already on this list are context, not decorations.
- Never schedule homework, studying, or other focus work AFTER wind-down, bedtime, or "retire for the night". Those blocks end the day.
- Titles must match the clock: no wake-up / gentle awakening / morning routine after 10:30 or after now if morning is over. Meals and wind-down must sit at plausible hours.`;
};

/** Today's calendar events as fixed blocks from neurosymbolic analysis. */
export const getTodayFixedEventsFromAnalysis = (tasks: AnalyzedTask[]): AnalyzedTask[] => {
  const today = todayStr();
  return tasks.filter((t) => t.date === today && Boolean(t.startTime));
};
