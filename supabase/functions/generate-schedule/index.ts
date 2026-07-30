import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserSettings {
  energyLevel: "motivated" | "unmotivated";
  stressLevel: "low" | "medium" | "high";
  wakeTime: string;
  bedTime: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      messages,
      settings,
      timezone,
      localDate,
      currentTime,
      currentLocalTime,
      currentLocalDate,
      utcOffsetMinutes,
      goals,
      calendarAnalysis,
      vibeChecks,
      optimizeMode,
    } = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      settings: UserSettings;
      goals?: Array<{
        id: string;
        title: string;
        category: string;
        goal_type: string;
        target_hours: number;
        totalLogged: number;
        remainingHours: number;
        suggestedDailyMinutes: number;
        streak: number;
      }>;
      calendarAnalysis?: Array<{
        title: string;
        date: string | null;
        startTime?: string | null;
        endTime?: string | null;
        final_category: string;
        final_importance: string;
        lead_days: number;
        recommended_start_date: string | null;
        prep_milestones: string[];
        rationale: string;
      }>;
      vibeChecks?: Array<{
        at: string;
        mood: string;
        energy: string;
        needBreak: boolean;
        adjustSchedule: string;
        notes: string;
      }>;
      optimizeMode?: "default" | "lighten" | "reschedule" | "critical_only";
      timezone?: string;
      localDate?: string;
      currentTime?: string;
      currentLocalTime?: string;
      currentLocalDate?: string;
      utcOffsetMinutes?: number;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating schedule with settings:", settings, "tz:", timezone);
    console.log("Messages count:", messages.length);

    const tz = timezone || "UTC";
    const offsetStr = typeof utcOffsetMinutes === "number"
      ? `UTC${utcOffsetMinutes >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(utcOffsetMinutes) / 60)).padStart(2, "0")}:${String(Math.abs(utcOffsetMinutes) % 60).padStart(2, "0")}`
      : "UTC";

    const todayIso =
      typeof localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
        ? localDate
        : (typeof currentTime === "string" ? currentTime : new Date().toISOString()).slice(0, 10);

    const calendarBlock =
      Array.isArray(calendarAnalysis) && calendarAnalysis.length > 0
        ? `\n\n═══════════════════════════════════════
NEUROSYMBOLIC CALENDAR ANALYSIS (SYMBOLIC + NEURAL FUSION)
═══════════════════════════════════════
${calendarAnalysis
          .map((t) => {
            const isToday = t.date === todayIso;
            const fixed = isToday && t.startTime ? " [FIXED TODAY]" : "";
            const time =
              t.startTime && t.endTime
                ? `${t.startTime}–${t.endTime}`
                : t.startTime || t.date || "unscheduled";
            const prep =
              t.prep_milestones?.length > 0
                ? `\n  Prep milestones: ${t.prep_milestones.join("; ")}`
                : "";
            return `- ${t.title}${fixed} (${time}, ${t.final_category}, ${t.final_importance})
  Prep by ${t.recommended_start_date ?? "ASAP"} (${t.lead_days}d lead)${prep}
  Rationale: ${t.rationale}`;
          })
          .join("\n")}

Use importance (critical>major>moderate>minor) and lead_days to prioritize prep blocks.
[FIXED TODAY] events are immovable walls with exact times.`
        : "";

    const vibeBlock =
      Array.isArray(vibeChecks) && vibeChecks.length > 0
        ? `\n\n═══════════════════════════════════════
VIBE CHECK SIGNALS (REAL-TIME USER STATE)
═══════════════════════════════════════
${vibeChecks
          .slice(-5)
          .map(
            (v) =>
              `- ${v.at}: mood=${v.mood}, energy=${v.energy}, adjust=${v.adjustSchedule}${v.needBreak ? ", needs break" : ""}${v.notes ? ` — "${v.notes}"` : ""}`,
          )
          .join("\n")}
${optimizeMode === "lighten" ? "\nMODE: LIGHTEN — defer non-urgent work, add breaks, reduce density." : ""}${optimizeMode === "reschedule" ? "\nMODE: RESCHEDULE — rebuild remaining day from current time." : ""}${optimizeMode === "critical_only" ? "\nMODE: CRITICAL ONLY — schedule [FIXED] calendar blocks + critical/deadline tasks ONLY. Defer moderate/minor/optional work. Short blocks, extra breaks." : ""}

Adapt pacing and breaks to vibe history. struggling/low energy → gentler schedule.`
        : "";

    const goalBlock = Array.isArray(goals) && goals.length > 0
      ? `\n\n═══════════════════════════════════════
LONG-TERM GOALS (MANDATORY DAILY BLOCKS)
═══════════════════════════════════════
${goals.map((g) =>
        `- 🎯 "${g.title}" (${g.category}, ${g.goal_type}) — ${g.totalLogged.toFixed(1)}h/${g.target_hours}h logged, ${g.remainingHours.toFixed(1)}h remaining, ${g.streak}d streak → schedule ~${g.suggestedDailyMinutes} min today`
      ).join("\n")}

Each active goal MUST appear as at least one schedule item with 🎯 in the title.
Never skip a goal to save time. Fit them in gaps around deadlines and [FIXED] events.`
      : "";

    const systemPrompt = `You are a ruthlessly effective schedule optimizer for college students. Your PRIMARY MISSION is helping students meet every deadline AND make daily progress on long-term goals.

User's current state:
- Energy Level: ${settings.energyLevel}
- Stress Level: ${settings.stressLevel}
- Wake Time: ${settings.wakeTime}
- Bed Time: ${settings.bedTime}
${goalBlock}${calendarBlock}${vibeBlock}

═══════════════════════════════════════
TIMEZONE & CURRENT TIME (CRITICAL)
═══════════════════════════════════════
- User timezone: ${tz} (${offsetStr})
- Current local date: ${currentLocalDate || "unknown"}
- Current local time: ${currentLocalTime || "unknown"} (24-hour, user local)
- ALL "time" / "endTime" fields in your output MUST be in this LOCAL timezone (${tz}), never UTC.
- Wake Time (${settings.wakeTime}) and Bed Time (${settings.bedTime}) are already in the user's local timezone.
- Never schedule tasks in the past: the FIRST task's "time" must be ≥ ${currentLocalTime || settings.wakeTime}.
- Any deadlines the user mentions (e.g. "due at 5 PM") are LOCAL TIME in ${tz}.
- For [FIXED] calendar events, the provided start/end times are already converted to ${tz} — copy them exactly.

═══════════════════════════════════════
DEADLINE OPTIMIZATION ENGINE — CORE RULES
═══════════════════════════════════════

1. DEADLINE-FIRST SCHEDULING (NON-NEGOTIABLE):
   - Parse ALL deadlines from user input. If a task says "due at 5 PM", "deadline 11:59 PM", "due tomorrow morning", etc., extract the exact time.
   - Sort tasks by deadline urgency: soonest deadline → scheduled first.
   - For each deadline task, work BACKWARDS from the deadline:
     * Subtract the estimated duration
     * Subtract a 15-min buffer (for review/submission)
     * That's the LATEST possible start time
     * Schedule it BEFORE that latest start, not after
   - If two deadline tasks conflict (not enough time for both), WARN THE USER IMMEDIATELY with specific times showing the conflict.
   - HIGH PRIORITY + deadline = gets the best focus time slot (morning for motivated users, after a break for unmotivated users).

2. CALENDAR EVENTS AS IMMUTABLE WALLS (CRITICAL):
   - Events marked [FIXED] CANNOT be moved, shortened, or overlapped.
   - You MUST copy their EXACT start time into the "time" field of the output. Do NOT change, round, or reassign their time.
   - If a fixed event says "[FIXED] Meeting (14:30 - 15:30)", the output MUST have "time": "14:30" and "endTime": "15:30".
   - Treat them as concrete walls. Schedule other tasks AROUND them — never during them.
   - Mark them in the output with "📌 Fixed" prefix in the description.

3. TIME-BLOCKING STRATEGY:
   - After placing deadlines and fixed blocks, fill remaining gaps with non-deadline tasks.
   - Non-deadline tasks sorted by priority: high → medium → low.
   - Never schedule a task that would make a deadline impossible to meet.
   - If a gap is too short for a full task, use it for a break or split the task.

4. BUFFER & SAFETY NETS:
   - Always add 15-min buffer before each deadline task's due time.
   - If stress is high, add extra 10-min decompression blocks before deadline tasks.
   - If energy is low, schedule deadline tasks in shorter 25-min pomodoro chunks with 5-min breaks.

5. DEADLINE WARNINGS (MUST INCLUDE):
   - If any deadline CANNOT be met given available time, say: "⚠️ WARNING: [Task] due at [time] may not be completable. You have [X] minutes available but need [Y] minutes."
   - If deadlines are tight but possible, say: "⏰ TIGHT: [Task] is scheduled with only [X] min buffer before the [time] deadline."

═══════════════════════════════════════

When generating the schedule, use this EXACT JSON format wrapped in <schedule> tags:
<schedule>
{
  "items": [
    {
      "title": "Task name",
      "time": "HH:MM",
      "endTime": "HH:MM",
      "description": "Brief description"
    }
  ]
}
</schedule>

IMPORTANT: "time" is the start time. "endTime" is when it ends. Both MUST be in HH:MM 24-hour format.
For [FIXED] calendar events, copy the start and end times EXACTLY as provided — do not change them.

Energy-based scheduling:
- Motivated: Front-load hardest deadline tasks in early slots, longer work blocks (60-90 min)
- Unmotivated: Start with a quick win (10-min easy task), then tackle deadlines in 25-min pomodoro blocks

Stress-based scheduling:
- High stress: 10-min breaks every 60 min, calming activity before deadline blocks
- Medium stress: 15-min breaks every 90 min
- Low stress: 15-min breaks every 2 hours

Always include: meals scheduled around fixed blocks, a wind-down before bedtime, at least 2-3 breaks, and one "treat yourself" activity.

Be encouraging and practical, but NEVER sacrifice deadline accuracy for whimsy. The schedule must be REALISTIC and ACHIEVABLE.`;


    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "Payment required, please add funds to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Generate schedule error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
