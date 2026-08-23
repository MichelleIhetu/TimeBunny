import { useState, useEffect, useCallback } from "react";
import { CheckInData } from "@/components/CheckInModal";

/** How often automatic vibe checks appear while a schedule is active. */
export const VIBE_CHECK_INTERVAL_MINUTES = 90;

interface UseHourlyCheckInProps {
  enabled: boolean;
  intervalMinutes?: number;
  onCheckInDue?: () => void;
}

interface CheckInHistory {
  timestamp: Date;
  data: CheckInData;
}

export const useHourlyCheckIn = ({ 
  enabled, 
  intervalMinutes = VIBE_CHECK_INTERVAL_MINUTES,
  onCheckInDue 
}: UseHourlyCheckInProps) => {
  const [isCheckInDue, setIsCheckInDue] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<CheckInHistory[]>([]);
  const [minutesUntilNextCheckIn, setMinutesUntilNextCheckIn] = useState(intervalMinutes);

  // Check if it's time for a check-in
  useEffect(() => {
    if (!enabled) {
      setIsCheckInDue(false);
      return;
    }

    const checkInterval = setInterval(() => {
      const now = new Date();
      
      if (lastCheckIn) {
        const timeSinceLastCheckIn = (now.getTime() - lastCheckIn.getTime()) / (1000 * 60);
        const remaining = Math.max(0, intervalMinutes - Math.floor(timeSinceLastCheckIn));
        setMinutesUntilNextCheckIn(remaining);
        
        if (timeSinceLastCheckIn >= intervalMinutes) {
          setIsCheckInDue(true);
          onCheckInDue?.();
        }
      } else {
        // If no check-in yet, start the timer from now
        setLastCheckIn(now);
        setMinutesUntilNextCheckIn(intervalMinutes);
      }
    }, 1000 * 30); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [enabled, lastCheckIn, intervalMinutes, onCheckInDue]);

  const completeCheckIn = useCallback((data: CheckInData) => {
    const now = new Date();
    setLastCheckIn(now);
    setIsCheckInDue(false);
    setMinutesUntilNextCheckIn(intervalMinutes);
    
    setCheckInHistory((prev) => [
      ...prev,
      { timestamp: now, data }
    ]);
  }, [intervalMinutes]);

  const skipCheckIn = useCallback(() => {
    setLastCheckIn(new Date());
    setIsCheckInDue(false);
    setMinutesUntilNextCheckIn(intervalMinutes);
  }, [intervalMinutes]);

  const triggerCheckIn = useCallback(() => {
    setIsCheckInDue(true);
    onCheckInDue?.();
  }, [onCheckInDue]);

  return {
    isCheckInDue,
    lastCheckIn,
    checkInHistory,
    minutesUntilNextCheckIn,
    completeCheckIn,
    skipCheckIn,
    triggerCheckIn,
  };
};
