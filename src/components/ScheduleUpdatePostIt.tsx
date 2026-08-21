import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import { formatUrgentDueLabel } from "@/lib/urgentScheduleItems";
import {
  SCHEDULE_UPDATE_NEEDED_EVENT,
  type ScheduleUpdateNoticeDetail,
} from "@/lib/scheduleUpdateNotice";

const AUTO_HIDE_MS = 45_000;

/**
 * Sticky post-it when a new task/event due within 24h appears during app use.
 */
export default function ScheduleUpdatePostIt() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<AnalyzedTask[]>([]);

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<ScheduleUpdateNoticeDetail>).detail;
      const tasks = detail?.tasks ?? [];
      if (tasks.length === 0) return;

      setItems(tasks);
      setVisible(true);
    };

    window.addEventListener(SCHEDULE_UPDATE_NEEDED_EVENT, onNotice);
    return () => window.removeEventListener(SCHEDULE_UPDATE_NEEDED_EVENT, onNotice);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(hide, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [visible, hide]);

  const handleUpdateSchedule = () => {
    hide();
    navigate("/", { state: { openScheduleView: true } });
  };

  if (!visible) return null;

  return (
    <aside
      className="fixed left-4 sm:left-6 top-[38%] z-[70] w-[13.5rem] sm:w-[15rem] rotate-[-2deg] shadow-lg pointer-events-auto print:hidden"
      role="status"
      aria-live="polite"
      style={{
        background: "linear-gradient(145deg, #fef9c3 0%, #fde68a 100%)",
        boxShadow: "4px 6px 14px rgba(91, 33, 182, 0.18)",
      }}
    >
      <div
        className="absolute top-0 right-8 w-10 h-4 opacity-35"
        style={{ background: "rgba(255,255,255,0.55)", transform: "rotate(-2deg)" }}
        aria-hidden
      />
      <div className="p-4 border border-amber-200/80">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p
            className="text-[10px] leading-snug text-amber-950 font-bold uppercase tracking-wide"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            New task or event added — update schedule
          </p>
          <button
            type="button"
            onClick={hide}
            className="shrink-0 p-0.5 text-amber-900/60 hover:text-amber-950"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <ul className="space-y-1 mb-3 max-h-28 overflow-y-auto" style={{ fontFamily: "'VT323', monospace" }}>
          {items.slice(0, 4).map((task) => (
            <li key={task.id} className="text-lg leading-tight text-amber-950/90">
              • {task.title}
              <span className="block text-sm text-amber-800/80">{formatUrgentDueLabel(task)}</span>
            </li>
          ))}
          {items.length > 4 && (
            <li className="text-sm text-amber-800/70">+{items.length - 4} more</li>
          )}
        </ul>

        <button
          type="button"
          onClick={handleUpdateSchedule}
          className="w-full py-2 text-[9px] uppercase tracking-wide font-bold text-white bg-[#5b21b6] border-2 border-[#5b21b6] shadow-[2px_2px_0_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-transform"
          style={{ fontFamily: "'Press Start 2P', cursive" }}
        >
          Update schedule
        </button>
      </div>
    </aside>
  );
}
