import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Sparkles, AlertTriangle, Clock, ArrowRight, Save, Check } from "lucide-react";
import bunnyMascot from "@/assets/bunny-mascot.png";

export interface AnalyzedTask {
  id: string;
  title: string;
  date: string | null;
  startTime?: string | null;
  endTime?: string | null;
  final_category: string;
  final_importance: "critical" | "major" | "moderate" | "minor";
  lead_days: number;
  recommended_start_date: string | null;
  prep_milestones: string[];
  rationale: string;
  symbolic: { category: string; matchedKeyword: string };
}

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

const importanceStyles: Record<AnalyzedTask["final_importance"], string> = {
  critical: "border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]",
  major: "border-[#fdba74] bg-[#fff7ed] text-[#9a3412]",
  moderate: "border-[#93c5fd] bg-[#eff6ff] text-[#1e40af]",
  minor: "border-[#86efac] bg-[#f0fdf4] text-[#166534]",
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onSave?: (tasks: AnalyzedTask[]) => void | Promise<void>;
  tasks: AnalyzedTask[];
  monthLabel: string;
}

const CalendarAnalysisModal = ({ isOpen, onClose, onNext, onSave, tasks, monthLabel }: Props) => {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const critical = tasks.filter((t) => t.final_importance === "critical").length;
  const major = tasks.filter((t) => t.final_importance === "major").length;

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const immediateCount = tasks.filter((t) => {
    if (!t.date) return false;
    const ts = new Date(t.date).getTime();
    return ts >= now - 24 * 60 * 60 * 1000 && ts <= now + sevenDaysMs;
  }).length;

  const isBusy = immediateCount >= 3;
  const titleText = isBusy ? "SOME BUNNY'S BEEN BUSY!" : `HOP TO IT — ${monthLabel.toUpperCase()}`;

  const handleNext = () => {
    onClose();
    onNext?.();
  };

  const handleSave = async () => {
    if (!onSave || tasks.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSave(tasks);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSaved(false);
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-w-2xl w-[calc(100%-2rem)] bg-[#fdf4ff] border-0 p-0 gap-0 overflow-hidden shadow-none [&>button]:hidden"
        style={{ boxShadow: "none" }}
      >
        <div className="relative bg-white border-2 border-[#5b21b6] shadow-[6px_6px_0px_#a78bfa] m-1 max-h-[90vh] flex flex-col">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#ddd6fe 1px, transparent 1px), linear-gradient(90deg, #ddd6fe 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          <DialogHeader className="relative z-10 px-5 pt-5 pb-3 border-b-2 border-[#ddd6fe] space-y-3">
            <div className="flex items-start gap-3 pr-2">
              <img
                src={bunnyMascot}
                alt=""
                aria-hidden
                className="w-14 h-14 object-contain drop-shadow-[2px_2px_0px_#a78bfa] pixel-img shrink-0"
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-[#5b21b6] text-[11px] sm:text-[12px] leading-relaxed flex items-center gap-2 flex-wrap" style={PIXEL}>
                  <Sparkles className="w-4 h-4 text-[#2dd4bf] shrink-0" />
                  {titleText}
                </DialogTitle>
                <p className="text-[#a78bfa] text-lg mt-2 leading-snug" style={VT}>
                  {isBusy
                    ? `${immediateCount} events in the next 7 days — let's plan ahead.`
                    : "Here's what TimeBunny found on your calendar."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[#7c6a9a] text-lg" style={VT}>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-[#ef4444]" /> {critical} critical
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-4 h-4 text-[#f97316]" /> {major} major
              </span>
              <span>· {tasks.length} events scanned</span>
            </div>
          </DialogHeader>

          <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 min-h-0">
            {tasks.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Calendar className="w-10 h-10 mx-auto text-[#c4b5fd]" />
                <p className="text-[#5b21b6] text-[10px]" style={PIXEL}>
                  NO UPCOMING EVENTS
                </p>
                <p className="text-[#a78bfa] text-xl" style={VT}>
                  Your calendar is clear — let's build a fresh schedule!
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {tasks.map((t) => (
                  <div key={t.id} className={`p-3 border-2 ${importanceStyles[t.final_importance]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[#5b21b6] text-[10px] leading-relaxed truncate" style={PIXEL}>
                          {t.title}
                        </p>
                        <p className="text-[#7c6a9a] text-lg leading-tight mt-1" style={VT}>
                          {t.final_category} · {t.date ?? "no date"}
                          {t.startTime ? ` · ${t.startTime}${t.endTime ? `–${t.endTime}` : ""}` : ""}
                        </p>
                      </div>
                      <span
                        className="text-[9px] uppercase tracking-wide px-2 py-0.5 border-2 border-current shrink-0"
                        style={PIXEL}
                      >
                        {t.final_importance}
                      </span>
                    </div>

                    <div className="mt-2 text-[#5b21b6] text-lg leading-snug" style={VT}>
                      <span className="font-semibold">Start prepping:</span> {t.recommended_start_date ?? "—"}{" "}
                      <span className="text-[#a78bfa]">
                        ({t.lead_days} day{t.lead_days === 1 ? "" : "s"} lead)
                      </span>
                    </div>

                    {t.prep_milestones.length > 0 && (
                      <ul className="mt-1 text-[#7c6a9a] text-lg list-disc list-inside" style={VT}>
                        {t.prep_milestones.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}

                    <p className="mt-1 text-[#a78bfa] text-base italic">{t.rationale}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative z-10 px-5 py-4 border-t-2 border-[#ddd6fe] flex flex-col sm:flex-row gap-3">
            {tasks.length > 0 && onSave && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-[10px] text-[#5b21b6] bg-white border-2 border-[#5b21b6] shadow-[3px_3px_0px_#5b21b6] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-60"
                style={PIXEL}
              >
                {saved ? <Check className="w-4 h-4 text-[#047857]" /> : <Save className="w-4 h-4" />}
                {saved ? "SAVED" : saving ? "SAVING…" : "SAVE IMPORT"}
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-[10px] text-white bg-[#5b21b6] border-2 border-[#5b21b6] shadow-[3px_3px_0px_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                style={PIXEL}
              >
                {tasks.length === 0 ? "NEXT" : "CONTINUE"}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarAnalysisModal;
