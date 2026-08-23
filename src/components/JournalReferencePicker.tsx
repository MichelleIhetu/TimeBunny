import { useMemo, useState } from "react";
import { Link2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CalendarEvent } from "@/components/CalendarImportModal";
import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";
import type { ScheduleItem } from "@/types/schedule";
import {
  analyzedTaskReference,
  calendarEventReference,
  scheduleItemReference,
  taskReference,
  type JournalReferenceInsert,
  type JournalTaskRef,
} from "@/lib/journalReferences";

type Props = {
  calendarEvents: CalendarEvent[];
  analyzedTasks: AnalyzedTask[];
  scheduleItems: ScheduleItem[];
  tasks: JournalTaskRef[];
  onInsert: (reference: JournalReferenceInsert) => void;
  onBeforeOpen?: () => void;
};

type RefItem = {
  key: string;
  label: string;
  sublabel?: string;
  sublabelClass?: string;
  reference: JournalReferenceInsert;
  searchText: string;
};

const importanceColor: Record<AnalyzedTask["final_importance"], string> = {
  critical: "text-red-600",
  major: "text-orange-600",
  moderate: "text-blue-600",
  minor: "text-emerald-600",
};

export default function JournalReferencePicker({
  calendarEvents,
  analyzedTasks,
  scheduleItems,
  tasks,
  onInsert,
  onBeforeOpen,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allItems = useMemo(() => {
    const items: RefItem[] = [];

    for (const event of calendarEvents) {
      const reference = calendarEventReference(event);
      items.push({
        key: `cal-${event.id}`,
        label: event.title,
        sublabel: event.isAllDay
          ? "All day"
          : `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}`,
        reference,
        searchText: [event.title, event.description, reference.display, "calendar"].join(" ").toLowerCase(),
      });
    }

    for (const task of analyzedTasks) {
      const reference = analyzedTaskReference(task);
      items.push({
        key: `evt-${task.id}`,
        label: task.title,
        sublabel: [task.final_category, task.date, task.startTime].filter(Boolean).join(" · "),
        sublabelClass: importanceColor[task.final_importance],
        reference,
        searchText: [
          task.title,
          task.final_category,
          task.rationale,
          task.date,
          task.startTime,
          task.final_importance,
          reference.display,
          "event",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }

    for (const task of tasks.filter((t) => t.title.trim())) {
      const reference = taskReference(task);
      items.push({
        key: `task-${task.id}`,
        label: task.title,
        sublabel: task.deadline ? `Due ${task.deadline}` : undefined,
        reference,
        searchText: [task.title, task.deadline, reference.display, "task"].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    for (const item of scheduleItems) {
      const reference = scheduleItemReference(item);
      items.push({
        key: `sched-${item.id}`,
        label: item.title,
        sublabel: item.time || undefined,
        reference,
        searchText: [item.title, item.description, item.time, reference.display, "schedule"]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }

    return items;
  }, [analyzedTasks, calendarEvents, scheduleItems, tasks]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => item.searchText.includes(q));
  }, [allItems, search]);

  const handlePick = (reference: JournalReferenceInsert) => {
    onInsert(reference);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBeforeOpen?.();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-colors"
          aria-label="Reference a task or calendar event"
          title="Reference a task or calendar event"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "0.55rem" }}>Reference</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-80 p-0 z-[100]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-primary/20 bg-primary/5 space-y-2">
          <p
            className="text-[10px] uppercase tracking-wide text-primary"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            Reference
          </p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks & events..."
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-primary/25 bg-background/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "0.5rem" }}
              autoFocus
            />
          </div>
        </div>

        {allItems.length === 0 ? (
          <div
            className="p-4 text-sm text-muted-foreground text-center"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Sync your calendar or add tasks first — then you can reference them here.
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            className="p-4 text-sm text-muted-foreground text-center"
            style={{ fontFamily: "var(--font-body)" }}
          >
            No tasks or events match &ldquo;{search.trim()}&rdquo;.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
            {filteredItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handlePick(item.reference)}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
              >
                <span
                  className="block text-[0.55rem] text-foreground truncate leading-relaxed"
                  style={{ fontFamily: "'Press Start 2P', cursive" }}
                >
                  {item.label}
                </span>
                {item.sublabel && (
                  <span
                    className={`block text-[0.5rem] truncate mt-0.5 ${item.sublabelClass ?? "text-muted-foreground"}`}
                    style={{ fontFamily: "'Press Start 2P', cursive" }}
                  >
                    {item.sublabel}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
