import type { AnalyzedTask } from "@/components/CalendarAnalysisModal";

export const SCHEDULE_UPDATE_NEEDED_EVENT = "timebunny:schedule-update-needed";
export const SCHEDULE_UPDATE_REQUEST_EVENT = "timebunny:request-schedule-update";

export type ScheduleUpdateNoticeDetail = {
  tasks: AnalyzedTask[];
  source: "calendar" | "manual";
};

export function dispatchScheduleUpdateNeeded(detail: ScheduleUpdateNoticeDetail) {
  if (detail.tasks.length === 0) return;
  window.dispatchEvent(new CustomEvent(SCHEDULE_UPDATE_NEEDED_EVENT, { detail }));
}

export function dispatchScheduleUpdateRequest() {
  window.dispatchEvent(new CustomEvent(SCHEDULE_UPDATE_REQUEST_EVENT));
}
