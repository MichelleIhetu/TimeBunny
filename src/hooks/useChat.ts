import { useState, useCallback } from "react";
import { ChatMessage, UserSettings, ScheduleItem } from "@/types/schedule";
import { fillGoalGapsInSchedule, type GoalForSchedule } from "@/lib/goalsSchedule";
import { enforceEveningContext, mergeScheduleUpdate } from "@/lib/scheduleAdjustments";
import {
  dropUnrequestedPastDueItems,
  filterCalendarAnalysisForSchedule,
  filterGoalsForSchedule,
} from "@/lib/schedulePastDue";
import {
  localDateString,
  localTimeString,
  getUserTimezone,
  getUtcOffsetMinutes,
} from "@/lib/localTime";
import type { ScheduleGenerationContext } from "@/lib/scheduleOptimizationContext";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-schedule`;

export function useChat(settings: UserSettings) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduleItem[]>([]);

  const parseScheduleFromContent = useCallback((content: string): ScheduleItem[] => {
    const scheduleMatch = content.match(/<schedule>([\s\S]*?)<\/schedule>/);
    if (!scheduleMatch) return [];
    
    try {
      const parsed = JSON.parse(scheduleMatch[1]);
      return parsed.items.map((item: any, index: number) => ({
        ...item,
        id: `generated-${Date.now()}-${index}`,
      }));
    } catch (e) {
      console.error("Failed to parse schedule:", e);
      return [];
    }
  }, []);

  const sendMessage = useCallback(async (
    input: string,
    options?: {
      goals?: Array<Record<string, unknown>>;
      calendarAnalysis?: ScheduleGenerationContext["calendarAnalysis"];
      vibeChecks?: ScheduleGenerationContext["vibeChecks"];
      optimizeMode?: ScheduleGenerationContext["optimizeMode"];
      existingSchedule?: ScheduleItem[];
      journalText?: string;
    },
  ) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const journalText = options?.journalText ?? "";
    const nowHHMM = localTimeString();
    const goalsForDay = filterGoalsForSchedule(
      (options?.goals ?? []) as GoalForSchedule[],
      { journalText },
    );
    const calendarForDay = filterCalendarAnalysisForSchedule(options?.calendarAnalysis, {
      journalText,
      nowHHMM,
    });

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          settings,
          goals: goalsForDay,
          calendarAnalysis: calendarForDay,
          vibeChecks: options?.vibeChecks ?? [],
          optimizeMode: options?.optimizeMode ?? "default",
          existingSchedule: options?.existingSchedule ?? [],
          timezone: getUserTimezone(),
          currentTime: new Date().toISOString(),
          localDate: localDateString(),
          currentLocalTime: nowHHMM,
          currentLocalDate: new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          utcOffsetMinutes: getUtcOffsetMinutes(),
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          toast.error("Rate limit exceeded. Please wait a moment and try again.");
        } else if (resp.status === 402) {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else {
          toast.error(errorData.error || "Failed to get response");
        }
        setIsLoading(false);
        return;
      }

      if (!resp.body) {
        throw new Error("No response body");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => 
                prev.map(m => 
                  m.id === assistantMessage.id 
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Check for schedule in final content
      const schedule = parseScheduleFromContent(assistantContent);
      if (schedule.length > 0) {
        const existing = options?.existingSchedule ?? [];
        const keepDroppedFuture =
          options?.optimizeMode === "lighten" || options?.optimizeMode === "critical_only";
        const withHistory =
          existing.length > 0
            ? mergeScheduleUpdate(existing, schedule, nowHHMM, {
                keepDroppedFuture,
                bedTime: settings.bedTime,
                wakeTime: settings.wakeTime,
              })
            : enforceEveningContext(schedule, {
                bedTime: settings.bedTime,
                wakeTime: settings.wakeTime,
                nowHHMM,
              });
        const withGoals =
          goalsForDay.length > 0
            ? fillGoalGapsInSchedule(withHistory, goalsForDay, settings)
            : withHistory;
        const withEvening = enforceEveningContext(withGoals, {
          bedTime: settings.bedTime,
          wakeTime: settings.wakeTime,
          nowHHMM,
        });
        const merged = dropUnrequestedPastDueItems(withEvening, {
          calendarAnalysis: options?.calendarAnalysis,
          goals: (options?.goals ?? []) as GoalForSchedule[],
          journalText,
          nowHHMM,
        });
        setGeneratedSchedule(merged);
        toast.success("Your schedule is ready! ✨");
      }

    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [messages, settings, parseScheduleFromContent]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setGeneratedSchedule([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    generatedSchedule,
    setGeneratedSchedule,
  };
}
