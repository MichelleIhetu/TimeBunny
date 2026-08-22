import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { schedule, goals, wakeTime, bedTime } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a schedule gap analyzer. Given a user's daily schedule and their long-term goals, find free time slots and suggest specific time blocks for working on goals.

Rules:
- The user is awake from ${wakeTime || "07:00"} to ${bedTime || "23:00"}
- Never overlap with existing schedule items
- Suggest realistic block sizes (minimum 15 min, prefer 25-50 min for focus work)
- Apply Atomic Habits principles: start small, habit stack (place goal blocks after existing habits)
- Consider goal category for optimal timing (fitness=morning, creative=evening, learning=afternoon)
- Prioritize IMPORTANT goals and goals with finish-by dates that are soon; schedule those before minor goals with distant deadlines
- For each suggestion, explain WHY that time slot works (e.g., "after lunch energy dip is good for light exercise")
- Maximum 4 suggestions per call
- Distribute suggestions across different goals if multiple are active

You MUST respond using the suggest_blocks tool.`;

    const goalsDesc = goals.map((g: any) => {
      const urgency = g.urgency === "important" ? "important" : "minor";
      const deadline = g.end_date ? `, finish by ${String(g.end_date).slice(0, 10)}` : "";
      return `- "${g.title}" (${g.category}, ${g.target_hours}h target, ${g.totalLogged.toFixed(1)}h done, ${g.goal_type}, ${urgency}${deadline})`;
    }).join("\n");

    const scheduleDesc = schedule.length > 0
      ? schedule.map((s: any) => `- ${s.time}: ${s.title}`).join("\n")
      : "No schedule items today (completely free day)";

    const userMessage = `Current schedule:\n${scheduleDesc}\n\nActive goals:\n${goalsDesc}\n\nFind gaps and suggest time blocks for these goals.`;

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
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_blocks",
              description: "Return suggested time blocks for goals",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        goalTitle: { type: "string", description: "Title of the goal this block is for" },
                        goalId: { type: "string", description: "ID of the goal" },
                        startTime: { type: "string", description: "Start time in HH:MM format" },
                        endTime: { type: "string", description: "End time in HH:MM format" },
                        durationMinutes: { type: "number", description: "Duration in minutes" },
                        activity: { type: "string", description: "Specific activity suggestion" },
                        reason: { type: "string", description: "Why this time slot works (Atomic Habits insight)" },
                        category: { type: "string" },
                      },
                      required: ["goalTitle", "startTime", "endTime", "durationMinutes", "activity", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_blocks" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI service error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No suggestions returned");
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("suggest-goal-blocks error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
