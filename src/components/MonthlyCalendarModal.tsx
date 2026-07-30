import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import bunnyMascot from "@/assets/bunny-mascot.png";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { CalendarEvent } from "@/lib/calendarSync";
import { syncAllCalendarProviders } from "@/lib/calendarSync";
import { fetchEventsFromProviders } from "@/lib/calendar";
import type { GoalWithProgress } from "@/hooks/useGoals";
import type { ScheduleItem } from "@/types/schedule";
import {
  buildMonthlyCalendarItems,
  getMonthGrid,
  groupItemsByDate,
  kindColors,
  kindLabels,
  monthRange,
  parseDateKey,
  toDateKey,
  type CalendarDayItem,
  type CalendarItemKind,
} from "@/lib/monthlyCalendarData";

import { EventKitConnectPanel } from "@/components/EventKitConnectPanel";
import { useEventKitCalendar } from "@/hooks/useEventKitCalendar";

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const importanceBorder: Record<NonNullable<CalendarDayItem["importance"]>, string> = {
  critical: "border-[#fca5a5]",
  major: "border-[#fdba74]",
  moderate: "border-[#93c5fd]",
  minor: "border-[#86efac]",
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  calendarTasks: AnalyzedTask[];
  goals: GoalWithProgress[];
  schedule: ScheduleItem[];
  isSignedIn: boolean;
  onCalendarTasksUpdated?: (tasks: AnalyzedTask[]) => void;
  saveCalendarImport?: (tasks: AnalyzedTask[]) => Promise<void>;
  onConnectCalendar?: () => void;
}

const MonthlyCalendarModal = ({
  isOpen,
  onClose,
  calendarTasks,
  goals,
  schedule,
  isSignedIn,
  onCalendarTasksUpdated,
  saveCalendarImport,
  onConnectCalendar,
}: Props) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const loadMonthEvents = useCallback(async () => {
    setLoading(true);
    try {
      const range = monthRange(viewYear, viewMonth);
      const { events } = await fetchEventsFromProviders(range, { forceRefresh: false });
      setRawEvents(events);
    } catch (err) {
      console.warn("[monthly-calendar]", err);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  const { isAvailable: eventKitAvailable, permission: eventKitPermission } = useEventKitCalendar({
    onCalendarChanged: () => {
      void loadMonthEvents();
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    void loadMonthEvents();
  }, [isOpen, loadMonthEvents]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedDate(todayKey);
  }, [isOpen, todayKey]);

  const allItems = useMemo(
    () =>
      buildMonthlyCalendarItems({
        calendarTasks,
        rawEvents,
        goals,
        schedule,
        scheduleDate: todayKey,
      }),
    [calendarTasks, rawEvents, goals, schedule, todayKey],
  );

  const itemsByDate = useMemo(() => groupItemsByDate(allItems), [allItems]);

  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedItems = itemsByDate.get(selectedDate) ?? [];

  const monthStats = useMemo(() => {
    let events = 0;
    let deadlines = 0;
    let tasks = 0;
    for (const item of allItems) {
      const d = parseDateKey(item.date);
      if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) continue;
      if (item.kind === "event") events++;
      else if (item.kind === "deadline") deadlines++;
      else if (item.kind === "task") tasks++;
    }
    return { events, deadlines, tasks, total: events + deadlines + tasks };
  }, [allItems, viewMonth, viewYear]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSync = async () => {
    if (!isSignedIn && !eventKitAvailable) {
      onConnectCalendar?.();
      return;
    }

    setSyncing(true);
    try {
      const range = monthRange(viewYear, viewMonth);
      const [syncResult, fetchResult] = await Promise.all([
        syncAllCalendarProviders({ existingTasks: calendarTasks, forceRefresh: true }),
        fetchEventsFromProviders(range, { forceRefresh: true }),
      ]);

      if (syncResult.needsAuth && fetchResult.events.length === 0) {
        toast("Connect Google Calendar to sync your events.", { icon: "📅" });
        onConnectCalendar?.();
        return;
      }

      if (syncResult.tasks.length > 0 || syncResult.newCount > 0) {
        onCalendarTasksUpdated?.(syncResult.tasks);
        await saveCalendarImport?.(syncResult.tasks);
      }
      setRawEvents(fetchResult.events);

      if (syncResult.newCount > 0) {
        toast.success(`${syncResult.newCount} new event${syncResult.newCount === 1 ? "" : "s"} synced`);
      } else {
        toast.success("Calendar synced");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not sync calendar");
    } finally {
      setSyncing(false);
    }
  };

  const kindsOnDay = (dateKey: string): CalendarItemKind[] => {
    const items = itemsByDate.get(dateKey) ?? [];
    const kinds = new Set<CalendarItemKind>();
    for (const item of items) kinds.add(item.kind);
    return Array.from(kinds);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] bg-[#fdf4ff] border-0 p-0 gap-0 overflow-hidden shadow-none [&>button]:hidden"
        style={{ boxShadow: "none" }}
      >
        <div className="relative bg-white border-2 border-[#5b21b6] shadow-[6px_6px_0px_#a78bfa] m-1 max-h-[92vh] flex flex-col">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#ddd6fe 1px, transparent 1px), linear-gradient(90deg, #ddd6fe 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* Header */}
          <div className="relative z-10 px-4 sm:px-5 pt-4 pb-3 border-b-2 border-[#ddd6fe]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <img
                  src={bunnyMascot}
                  alt=""
                  aria-hidden
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-[2px_2px_0px_#a78bfa] pixel-img shrink-0"
                  draggable={false}
                />
                <div className="min-w-0">
                  <h2 className="text-[#5b21b6] text-[10px] sm:text-[11px] leading-relaxed" style={PIXEL}>
                    MY CALENDAR
                  </h2>
                  <p className="text-[#a78bfa] text-lg sm:text-xl mt-1 leading-snug" style={VT}>
                    Events, tasks & deadlines — all in one hop.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 p-2 rounded-full border-2 border-[#ddd6fe] text-[#7c6a9a] hover:bg-[#fdf4ff] transition-colors"
                aria-label="Close calendar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[#7c6a9a] text-base sm:text-lg" style={VT}>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: kindColors.event }} />
                {monthStats.events} events
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: kindColors.deadline }} />
                {monthStats.deadlines} deadlines
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: kindColors.task }} />
                {monthStats.tasks} tasks
              </span>
            </div>
          </div>

          {eventKitAvailable && eventKitPermission !== "granted" && (
            <div className="relative z-10 px-4 sm:px-5 pb-3">
              <EventKitConnectPanel onConnected={() => void loadMonthEvents()} />
            </div>
          )}

          {/* Month navigation */}
          <div className="relative z-10 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b border-[#ede9fe]">
            <button
              type="button"
              onClick={goPrevMonth}
              className="p-2 rounded-full border-2 border-[#5b21b6] text-[#5b21b6] shadow-[2px_2px_0_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-transform"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center min-w-0">
              <p className="text-[#5b21b6] text-[10px] sm:text-[11px] truncate" style={PIXEL}>
                {monthLabel.toUpperCase()}
              </p>
              {loading && (
                <p className="text-[#a78bfa] text-sm mt-0.5 flex items-center justify-center gap-1" style={VT}>
                  <Loader2 className="w-3 h-3 animate-spin" /> loading…
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={goNextMonth}
              className="p-2 rounded-full border-2 border-[#5b21b6] text-[#5b21b6] shadow-[2px_2px_0_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-transform"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto min-h-0">
            <div className="p-4 sm:p-5">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[#a78bfa] text-sm sm:text-base py-1"
                    style={VT}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="space-y-1">
                {monthGrid.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((date) => {
                      const dateKey = toDateKey(date);
                      const inMonth = date.getMonth() === viewMonth;
                      const isToday = dateKey === todayKey;
                      const isSelected = dateKey === selectedDate;
                      const dayItems = itemsByDate.get(dateKey) ?? [];
                      const kinds = kindsOnDay(dateKey);

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => setSelectedDate(dateKey)}
                          className={[
                            "relative min-h-[52px] sm:min-h-[64px] p-1 sm:p-1.5 border-2 text-left transition-all",
                            inMonth ? "bg-white" : "bg-[#faf5ff]/60",
                            isSelected
                              ? "border-[#5b21b6] shadow-[2px_2px_0_#a78bfa] scale-[1.02] z-10"
                              : "border-[#ede9fe] hover:border-[#c4b5fd]",
                            isToday && !isSelected ? "ring-2 ring-[#2dd4bf] ring-offset-1" : "",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "text-[9px] sm:text-[10px] leading-none block",
                              inMonth ? "text-[#5b21b6]" : "text-[#c4b5fd]",
                            ].join(" ")}
                            style={PIXEL}
                          >
                            {date.getDate()}
                          </span>

                          {dayItems.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
                              {kinds.slice(0, 4).map((kind) => (
                                <span
                                  key={kind}
                                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
                                  style={{ background: kindColors[kind] }}
                                  title={kindLabels[kind]}
                                />
                              ))}
                              {dayItems.length > 4 && (
                                <span className="text-[8px] text-[#a78bfa]" style={VT}>
                                  +
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Selected day detail */}
              <div className="mt-5 border-t-2 border-[#ddd6fe] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-[#5b21b6]" />
                  <h3 className="text-[#5b21b6] text-[9px] sm:text-[10px]" style={PIXEL}>
                    {parseDateKey(selectedDate).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }).toUpperCase()}
                  </h3>
                </div>

                {selectedItems.length === 0 ? (
                  <div className="py-6 text-center border-2 border-dashed border-[#ddd6fe] bg-[#fdf4ff]/50">
                    <p className="text-[#a78bfa] text-xl" style={VT}>
                      Nothing scheduled — a perfect day to plan something cozy.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedItems.map((item) => (
                      <DayItemRow key={`${item.kind}-${item.id}-${item.date}`} item={item} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 px-4 sm:px-5 py-4 border-t-2 border-[#ddd6fe] flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-[9px] sm:text-[10px] text-[#5b21b6] bg-white border-2 border-[#5b21b6] shadow-[3px_3px_0px_#5b21b6] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-60"
              style={PIXEL}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isSignedIn ? (syncing ? "SYNCING…" : "SYNC CALENDAR") : "CONNECT CALENDAR"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-[9px] sm:text-[10px] text-white bg-[#5b21b6] border-2 border-[#5b21b6] shadow-[3px_3px_0px_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              style={PIXEL}
            >
              CLOSE
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function DayItemRow({ item }: { item: CalendarDayItem }) {
  const borderClass = item.importance ? importanceBorder[item.importance] : "border-[#ede9fe]";

  return (
    <div className={`p-3 border-2 bg-white ${borderClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: kindColors[item.kind] }}
            />
            <span className="text-[#a78bfa] text-sm uppercase tracking-wide" style={VT}>
              {kindLabels[item.kind]}
            </span>
          </div>
          <p className="text-[#5b21b6] text-[9px] sm:text-[10px] leading-relaxed" style={PIXEL}>
            {item.title}
          </p>
          {(item.time || item.category) && (
            <p className="text-[#7c6a9a] text-base sm:text-lg mt-1 flex items-center gap-2 flex-wrap" style={VT}>
              {item.time && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {item.time}
                  {item.endTime ? `–${item.endTime}` : ""}
                </span>
              )}
              {item.category && (
                <span className="inline-flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {item.category}
                </span>
              )}
            </p>
          )}
        </div>
        {item.importance && (
          <span
            className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 border border-current shrink-0 text-[#7c6a9a]"
            style={PIXEL}
          >
            {item.importance}
          </span>
        )}
      </div>
    </div>
  );
}

export default MonthlyCalendarModal;
