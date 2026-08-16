import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export type AppPlatform = "web" | "ios" | "android";

export function usePlatform() {
  const isMobileViewport = useIsMobile();
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<AppPlatform>("web");

  useEffect(() => {
    let cancelled = false;

    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (cancelled || !Capacitor.isNativePlatform()) return;
        setIsNative(true);
        const p = Capacitor.getPlatform();
        setPlatform(p === "ios" || p === "android" ? p : "web");
      })
      .catch(() => {
        /* web-only build */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Bottom tab bar + safe-area shell (native app or phone-sized browser). */
  const useMobileChrome = isNative || isMobileViewport;

  return { isNative, platform, useMobileChrome, isMobileViewport };
}
