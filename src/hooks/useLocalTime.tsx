import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getLocalTimeSnapshot,
  startLocalTimeSync,
  type LocalTimeSnapshot,
} from "@/lib/localTime";

const LocalTimeContext = createContext<LocalTimeSnapshot>(getLocalTimeSnapshot());

export function LocalTimeProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(() => getLocalTimeSnapshot());

  useEffect(() => startLocalTimeSync(() => setSnapshot(getLocalTimeSnapshot())), []);

  const value = useMemo(() => snapshot, [snapshot]);

  return <LocalTimeContext.Provider value={value}>{children}</LocalTimeContext.Provider>;
}

export function useLocalTime(): LocalTimeSnapshot {
  return useContext(LocalTimeContext);
}

/** Convenience — today's YYYY-MM-DD in user timezone (reactive). */
export function useLocalDateString(): string {
  return useLocalTime().localDate;
}
