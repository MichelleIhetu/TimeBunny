import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useGoals } from "@/hooks/useGoals";
import { useSchedulePersistence } from "@/hooks/useSchedulePersistence";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import { CALENDAR_SYNCED_EVENT } from "@/lib/calendarSync";
import {
  collectImportantWeekTasks,
  formatWeekTime,
  groupImportantWeekTasks,
} from "@/lib/importantWeekTasks";
import { useLocalTime } from "@/hooks/useLocalTime";
import { getDayName } from "@/lib/dayGreetings";

const OPEN_KEY = "timebunny:week-panel-open";
const HIDDEN_ROUTES = ["/auth"];

const importanceClass: Record<"critical" | "major", string> = {
  critical: "border-[#fca5a5] bg-[#fef2f2]",
  major: "border-[#fdba74] bg-[#fff7ed]",
};

const kindLabel: Record<"event" | "prep" | "goal", string> = {
  event: "Due",
  prep: "Prep",
  goal: "Goal",
};

function readOpenPref(): boolean {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
    if (typeof window !== "undefined" && window.innerWidth < 768) return false;
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Secondary context window: this week's critical/major calendar items and important goals.
 */
export default function ImportantWeekPanel() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { goals } = useGoals();
  const { loadTodaySchedule } = useSchedulePersistence(user?.id);
  const [tasks, setTasks] = useState<AnalyzedTask[]>([]);
  const [open, setOpen] = useState(readOpenPref);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    loadTodaySchedule().then((session) => {
      if (cancelled) return;
      setTasks(session?.calendarImport ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [user, loadTodaySchedule]);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const next = (event as CustomEvent<{ tasks?: AnalyzedTask[] }>).detail?.tasks;
      if (next) setTasks(next);
    };
    window.addEventListener(CALENDAR_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(CALENDAR_SYNCED_EVENT, onSynced);
  }, []);

  const { localDate: today, localTime, now } = useLocalTime();
  const items = useMemo(
    () => collectImportantWeekTasks(tasks, goals, today, localTime),
    [tasks, goals, today, localTime],
  );
  const groups = useMemo(() => groupImportantWeekTasks(items, today), [items, today]);
  const clockLabel = `${getDayName(now)} · ${formatWeekTime(localTime) ?? localTime}`;

  if (!user || HIDDEN_ROUTES.some((route) => pathname.startsWith(route))) return null;

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <motion.aside
      drag
      dragMomentum={false}
      dragElastic={0}
      role="complementary"
      aria-label="Important tasks this week"
      className="fixed top-24 right-3 sm:right-6 z-[58] w-[15.5rem] sm:w-64 cursor-grab active:cursor-grabbing print:hidden"
      style={{ touchAction: "none" }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 shadow-lg transition-all hover:brightness-105"
        style={{
          background: "hsl(40 60% 96%)",
          border: "2px solid hsl(280 30% 75%)",
          borderBottom: open ? "none" : undefined,
          borderRadius: open ? "1rem 1rem 0 0" : "1rem",
        }}
      >
        <span className="text-xs opacity-40" aria-hidden>
          ⠿
        </span>
        <span
          className="text-sm font-semibold flex-1 text-left leading-tight"
          style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 25%)" }}
        >
          This Week
          <span className="block text-[10px] font-medium opacity-70">{clockLabel}</span>
        </span>
        {items.length > 0 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
            style={{ background: "hsl(280 45% 48%)", fontFamily: "var(--font-body)" }}
          >
            {items.length}
          </span>
        )}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: "hsl(280 40% 50%)" }}
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-b-2xl shadow-lg"
            style={{
              background: "hsl(40 50% 98%)",
              border: "2px solid hsl(280 30% 75%)",
              borderTop: "1px solid hsl(280 30% 85%)",
            }}
          >
            <div className="max-h-[45vh] overflow-y-auto p-2 space-y-2">
              {groups.length === 0 ? (
                <p
                  className="text-xs text-center py-3 px-2"
                  style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 50%)" }}
                >
                  No critical or major tasks this week. You're clear.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.date} className="space-y-1.5">
                    <p
                      className="text-[10px] uppercase tracking-wider px-1"
                      style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 55%)" }}
                    >
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const timeLabel = formatWeekTime(item.time);
                      const statusLabel = item.happeningNow
                        ? item.remainingMinutes != null
                          ? `Now · ${item.remainingMinutes} min left`
                          : "Happening now"
                        : `${kindLabel[item.kind]}${timeLabel ? ` · ${timeLabel}` : ""}`;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.date === today) {
                              navigate("/", { state: { openScheduleView: true } });
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${importanceClass[item.importance]}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className="text-xs font-semibold leading-snug"
                              style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 22%)" }}
                            >
                              {item.title}
                            </span>
                            <span
                              className="text-[9px] uppercase tracking-wide shrink-0 mt-0.5"
                              style={{
                                fontFamily: "var(--font-body)",
                                color:
                                  item.importance === "critical"
                                    ? "#991b1b"
                                    : "#9a3412",
                              }}
                            >
                              {item.importance}
                            </span>
                          </div>
                          <p
                            className="text-[10px] mt-0.5 opacity-80"
                            style={{ fontFamily: "var(--font-body)", color: "hsl(280 40% 35%)" }}
                          >
                            {statusLabel}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.aside>
  );
}
