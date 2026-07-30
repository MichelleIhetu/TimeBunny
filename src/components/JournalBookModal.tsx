import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Loader2, Search, Calendar as CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import journalBook from "@/assets/journal-book.png";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import {
  extractImportsFromSettings,
  loadLocalCalendarImportHistory,
  mergeCalendarImportHistory,
  type SavedCalendarImport,
} from "@/lib/calendarImportHistory";

interface JournalEntry {
  id: string;
  content: string;
  created_at: string;
}

interface ScheduleRow {
  schedule_date: string;
  schedule_data: any;
  journal_text: string | null;
  settings?: unknown;
  updated_at: string;
}

interface JournalBookModalProps {
  open: boolean;
  onClose: () => void;
}

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDate = (yyyyMmDd: string) => {
  const d = new Date(yyyyMmDd + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type Tab = "entries" | "schedules" | "calendar";

const importanceLabel: Record<AnalyzedTask["final_importance"], string> = {
  critical: "text-red-600",
  major: "text-orange-600",
  moderate: "text-blue-600",
  minor: "text-emerald-600",
};

const JournalBookModal = ({ open, onClose }: JournalBookModalProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("entries");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [calendarImports, setCalendarImports] = useState<SavedCalendarImport[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const localImports = loadLocalCalendarImportHistory();

    if (!user) {
      setEntries([]);
      setSchedules([]);
      setCalendarImports(localImports);
      setLoading(false);
      return;
    }

    Promise.all([
      supabase
        .from("journal_entries")
        .select("id, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("user_schedules")
        .select("schedule_date, schedule_data, journal_text, settings, updated_at")
        .eq("user_id", user.id)
        .order("schedule_date", { ascending: false })
        .limit(365),
    ]).then(([entriesRes, schedulesRes]) => {
      if (cancelled) return;
      if (entriesRes.error) console.error("Failed to load journal entries", entriesRes.error);
      if (schedulesRes.error) console.error("Failed to load schedules", schedulesRes.error);
      setEntries((entriesRes.data as JournalEntry[]) ?? []);
      const scheduleRows = (schedulesRes.data as ScheduleRow[]) ?? [];
      setSchedules(scheduleRows);
      const remoteImports = scheduleRows.flatMap((row) =>
        extractImportsFromSettings(row.settings, row.schedule_date),
      );
      setCalendarImports(mergeCalendarImportHistory(localImports, remoteImports));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = startDate ? new Date(startDate + "T00:00:00").getTime() : null;
    const end = endDate ? new Date(endDate + "T23:59:59").getTime() : null;
    return entries.filter((e) => {
      const t = new Date(e.created_at).getTime();
      if (start !== null && t < start) return false;
      if (end !== null && t > end) return false;
      if (q && !e.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, search, startDate, endDate]);

  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules.filter((s) => {
      // schedule_date is YYYY-MM-DD; compare lexicographically
      if (startDate && s.schedule_date < startDate) return false;
      if (endDate && s.schedule_date > endDate) return false;
      if (!q) return true;
      const items = Array.isArray(s.schedule_data) ? s.schedule_data : [];
      const hay = [
        s.journal_text ?? "",
        ...items.map((i: any) => `${i?.title ?? ""} ${i?.description ?? ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [schedules, search, startDate, endDate]);

  const filteredCalendarImports = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = startDate ? new Date(startDate + "T00:00:00").getTime() : null;
    const end = endDate ? new Date(endDate + "T23:59:59").getTime() : null;
    return calendarImports.filter((imp) => {
      const t = new Date(imp.savedAt).getTime();
      if (start !== null && t < start) return false;
      if (end !== null && t > end) return false;
      if (!q) return true;
      const hay = imp.tasks
        .map((task) =>
          [task.title, task.final_category, task.rationale, task.date, task.startTime]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [calendarImports, search, startDate, endDate]);

  const clearFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
  };

  const toggle = (key: string) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const activeCount =
    tab === "entries"
      ? filteredEntries.length
      : tab === "schedules"
        ? filteredSchedules.length
        : filteredCalendarImports.length;
  const totalCount =
    tab === "entries" ? entries.length : tab === "schedules" ? schedules.length : calendarImports.length;
  const unit = tab === "entries" ? "entry" : tab === "schedules" ? "schedule" : "import";
  const unitPlural =
    tab === "entries" ? "entries" : tab === "schedules" ? "schedules" : "imports";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border-4 border-primary/40 shadow-2xl overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-primary/20 bg-primary/10">
              <div className="flex items-center gap-3">
                <img
                  src={journalBook}
                  alt="Journal book"
                  width={40}
                  height={40}
                  loading="lazy"
                  className="w-10 h-10 [image-rendering:pixelated] drop-shadow"
                />
                <h2
                  className="text-lg text-foreground"
                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                  My Journal
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close journal book"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b-2 border-primary/20 bg-background/30">
              {(["entries", "schedules", "calendar"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-wide transition-colors ${
                    tab === t
                      ? "bg-primary/15 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                  {t === "entries" ? "Entries" : t === "schedules" ? "Schedules" : "Calendar"}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b-2 border-primary/20 bg-background/40 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    tab === "entries"
                      ? "Search entries..."
                      : tab === "schedules"
                        ? "Search schedules & tasks..."
                        : "Search calendar imports..."
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-lg border-2 border-primary/20 bg-background/70 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  style={{ fontFamily: "var(--font-body)" }}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarIcon className="w-3.5 h-3.5" /> From
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 rounded-md border-2 border-primary/20 bg-background/70 text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
                <span className="text-xs text-muted-foreground">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 rounded-md border-2 border-primary/20 bg-background/70 text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
                {(search || startDate || endDate) && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto text-xs px-2 py-1 rounded-md border-2 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    Clear
                  </button>
                )}
              </div>
              {!loading && (
                <div className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                  Showing {activeCount} of {totalCount} {totalCount === 1 ? unit : unitPlural}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Opening your book...
                </div>
              ) : tab === "entries" ? (
                entries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <BookOpen className="w-10 h-10 mb-3 opacity-60" />
                    <p style={{ fontFamily: "var(--font-body)" }}>
                      No entries yet. Write about your day and it'll be saved here.
                    </p>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <BookOpen className="w-10 h-10 mb-3 opacity-60" />
                    <p style={{ fontFamily: "var(--font-body)" }}>
                      No entries match your search or date range.
                    </p>
                  </div>
                ) : (
                  filteredEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border-2 border-primary/20 bg-background/60 p-4 shadow-sm"
                    >
                      <div
                        className="text-xs text-primary mb-2"
                        style={{ fontFamily: "'Press Start 2P', monospace" }}
                      >
                        {formatWhen(entry.created_at)}
                      </div>
                      <p
                        className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {entry.content}
                      </p>
                    </div>
                  ))
                )
              ) : tab === "schedules" ? (
                schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <CalendarIcon className="w-10 h-10 mb-3 opacity-60" />
                    <p style={{ fontFamily: "var(--font-body)" }}>
                      No saved schedules yet. Once you generate a schedule, it'll appear here.
                    </p>
                  </div>
                ) : filteredSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <CalendarIcon className="w-10 h-10 mb-3 opacity-60" />
                    <p style={{ fontFamily: "var(--font-body)" }}>
                      No schedules match your search or date range.
                    </p>
                  </div>
                ) : (
                  filteredSchedules.map((s) => {
                    const items = Array.isArray(s.schedule_data) ? s.schedule_data : [];
                    const isOpen = !!expanded[s.schedule_date];
                    return (
                      <div
                        key={s.schedule_date}
                        className="rounded-xl border-2 border-primary/20 bg-background/60 shadow-sm overflow-hidden"
                      >
                        <button
                          onClick={() => toggle(s.schedule_date)}
                          className="w-full flex items-center justify-between p-4 hover:bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-primary" />
                            )}
                            <span
                              className="text-xs text-primary"
                              style={{ fontFamily: "'Press Start 2P', monospace" }}
                            >
                              {formatDate(s.schedule_date)}
                            </span>
                          </div>
                          <span
                            className="text-xs text-muted-foreground"
                            style={{ fontFamily: "var(--font-body)" }}
                          >
                            {items.length} {items.length === 1 ? "task" : "tasks"}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 space-y-2 border-t border-primary/10">
                            {s.journal_text && (
                              <div className="pt-3">
                                <div
                                  className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-1"
                                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                                >
                                  Journal
                                </div>
                                <p
                                  className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
                                  style={{ fontFamily: "var(--font-body)" }}
                                >
                                  {s.journal_text}
                                </p>
                              </div>
                            )}
                            {items.length > 0 ? (
                              <ul className="pt-2 space-y-1">
                                {items.map((it: any, idx: number) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-2 text-sm text-foreground"
                                    style={{ fontFamily: "var(--font-body)" }}
                                  >
                                    <span className="text-primary mt-0.5">•</span>
                                    <div>
                                      {(it?.startTime || it?.endTime) && (
                                        <span className="text-xs text-muted-foreground mr-2">
                                          {it?.startTime}
                                          {it?.endTime ? `–${it.endTime}` : ""}
                                        </span>
                                      )}
                                      <span>{it?.title ?? "Untitled task"}</span>
                                      {it?.description && (
                                        <div className="text-xs text-muted-foreground">
                                          {it.description}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p
                                className="text-xs text-muted-foreground pt-2"
                                style={{ fontFamily: "var(--font-body)" }}
                              >
                                No tasks were saved for this day.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              ) : calendarImports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <CalendarIcon className="w-10 h-10 mb-3 opacity-60" />
                  <p style={{ fontFamily: "var(--font-body)" }}>
                    No saved calendar imports yet. Sync your calendar and tap <strong>Save Import</strong> on the debrief screen.
                  </p>
                </div>
              ) : filteredCalendarImports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <CalendarIcon className="w-10 h-10 mb-3 opacity-60" />
                  <p style={{ fontFamily: "var(--font-body)" }}>
                    No calendar imports match your search or date range.
                  </p>
                </div>
              ) : (
                filteredCalendarImports.map((imp) => {
                  const isOpen = !!expanded[imp.id];
                  const critical = imp.tasks.filter((t) => t.final_importance === "critical").length;
                  const major = imp.tasks.filter((t) => t.final_importance === "major").length;
                  return (
                    <div
                      key={imp.id}
                      className="rounded-xl border-2 border-primary/20 bg-background/60 shadow-sm overflow-hidden"
                    >
                      <button
                        onClick={() => toggle(imp.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-primary/5 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div
                              className="text-xs text-primary"
                              style={{ fontFamily: "'Press Start 2P', monospace" }}
                            >
                              {formatWhen(imp.savedAt)}
                            </div>
                            <div
                              className="text-xs text-muted-foreground mt-1"
                              style={{ fontFamily: "var(--font-body)" }}
                            >
                              Day {formatDate(imp.scheduleDate)}
                            </div>
                          </div>
                        </div>
                        <span
                          className="text-xs text-muted-foreground shrink-0 ml-2"
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          {imp.tasks.length} events
                          {(critical > 0 || major > 0) && ` · ${critical}c ${major}m`}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2 border-t border-primary/10">
                          {imp.tasks.map((task) => (
                            <div
                              key={task.id}
                              className="pt-2 border-b border-primary/10 last:border-0 pb-2 last:pb-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className="text-sm text-foreground font-semibold"
                                  style={{ fontFamily: "var(--font-body)" }}
                                >
                                  {task.title}
                                </p>
                                <span
                                  className={`text-[10px] uppercase tracking-wide shrink-0 ${importanceLabel[task.final_importance]}`}
                                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                                >
                                  {task.final_importance}
                                </span>
                              </div>
                              <p
                                className="text-xs text-muted-foreground mt-0.5"
                                style={{ fontFamily: "var(--font-body)" }}
                              >
                                {task.final_category}
                                {task.date ? ` · ${task.date}` : ""}
                                {task.startTime ? ` · ${task.startTime}` : ""}
                              </p>
                              {task.rationale && (
                                <p
                                  className="text-xs text-muted-foreground mt-1 italic"
                                  style={{ fontFamily: "var(--font-body)" }}
                                >
                                  {task.rationale}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default JournalBookModal;
