export const POMODORO_BUNNY_POS_KEY = "timebunny_pomodoro_bunny_pos";
export const POMODORO_BUBBLE_POS_KEY = "timebunny_pomodoro_bubble_pos";

/** Permanent Pomodoro bunny scale (tuned). */
export const POMODORO_BUNNY_FIXED_SCALE = 2.55;
export const POMODORO_BUNNY_BASE_REM = 12;

export type PomodoroCompanionPosition = {
  left: number;
  bottom: number;
};

function parsePosition(raw: string | null): PomodoroCompanionPosition | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PomodoroCompanionPosition;
    if (typeof parsed.left === "number" && typeof parsed.bottom === "number") {
      return parsed;
    }
  } catch {}
  return null;
}

/** Permanent Pomodoro bunny placement (container-relative px). Set after drag tuning. */
export const POMODORO_BUNNY_FIXED_POSITION: PomodoroCompanionPosition | null = null;

/** Saved bunny placement from drag tuning — applied when fixed constant is unset. */
export function loadPomodoroBunnyPosition(): PomodoroCompanionPosition | null {
  if (typeof window === "undefined") return null;
  return parsePosition(localStorage.getItem(POMODORO_BUNNY_POS_KEY));
}

export function getPomodoroBunnyPosition(): PomodoroCompanionPosition | null {
  return POMODORO_BUNNY_FIXED_POSITION ?? loadPomodoroBunnyPosition();
}

/** Permanent Pomodoro speech bubble placement (container-relative px). Set after drag tuning. */
export const POMODORO_BUBBLE_FIXED_POSITION: PomodoroCompanionPosition | null = null;

/** Saved bubble placement from drag tuning — applied when fixed constant is unset. */
export function loadPomodoroBubblePosition(): PomodoroCompanionPosition | null {
  if (typeof window === "undefined") return null;
  return parsePosition(localStorage.getItem(POMODORO_BUBBLE_POS_KEY));
}

export function getPomodoroBubblePosition(): PomodoroCompanionPosition | null {
  return POMODORO_BUBBLE_FIXED_POSITION ?? loadPomodoroBubblePosition();
}

/** Fine-tune locked bubble placement (1 pace = 1rem). */
export const POMODORO_BUBBLE_OFFSET_PACES = { right: 1, down: 2 };

export function applyPomodoroBubbleOffset(pos: PomodoroCompanionPosition): PomodoroCompanionPosition {
  const pace = rootFontPx();
  return {
    left: pos.left + POMODORO_BUBBLE_OFFSET_PACES.right * pace,
    bottom: pos.bottom - POMODORO_BUBBLE_OFFSET_PACES.down * pace,
  };
}

export function pomodoroBunnyHitboxRem(scale: number): number {
  return POMODORO_BUNNY_BASE_REM * scale;
}

export function readContainerPosition(
  element: HTMLElement,
  container: HTMLElement,
): PomodoroCompanionPosition {
  const elRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return {
    left: elRect.left - containerRect.left,
    bottom: containerRect.bottom - elRect.bottom,
  };
}

function rootFontPx(): number {
  if (typeof window === "undefined") return 16;
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** Discard stale viewport coords saved before container-relative layout. */
export function normalizePomodoroSavedPosition(
  pos: PomodoroCompanionPosition | null,
  containerWidth: number,
  containerHeight: number,
): PomodoroCompanionPosition | null {
  if (!pos) return null;
  if (
    pos.left < -200 ||
    pos.bottom < -200 ||
    pos.left > containerWidth + 200 ||
    pos.bottom > containerHeight + 200
  ) {
    return null;
  }
  return pos;
}

/** Bottom-right default matching POMODORO_BUNNY_DEFAULT_CLASS (for bubble anchoring). */
export function defaultPomodoroBunnyPosition(
  containerWidth: number,
  hitboxRem: number,
): PomodoroCompanionPosition {
  const rootPx = rootFontPx();
  const insetRight = (containerWidth >= 640 ? 2 : 1) * rootPx;
  const insetBottom = (containerWidth >= 640 ? 2 : 1.5) * rootPx;
  const hitboxPx = hitboxRem * rootPx;
  return {
    left: Math.max(0, containerWidth - insetRight - hitboxPx),
    bottom: insetBottom,
  };
}

/** Place the speech bubble above the bunny's head. */
export function defaultPomodoroBubblePosition(
  bunnyPos: PomodoroCompanionPosition,
  hitboxRem: number,
  containerWidth: number,
  containerHeight: number,
): PomodoroCompanionPosition {
  const rootPx = rootFontPx();
  const hitboxPx = hitboxRem * rootPx;
  const bubbleWidthPx = (containerWidth >= 640 ? 14 : 12) * rootPx;
  const bunnyCenterLeft = bunnyPos.left + hitboxPx * 0.55;
  const left = Math.min(
    Math.max(8, bunnyCenterLeft - bubbleWidthPx / 2),
    Math.max(8, containerWidth - bubbleWidthPx - 8),
  );
  const bottom = Math.min(
    bunnyPos.bottom + hitboxPx + 12,
    containerHeight - 100,
  );
  return { left, bottom };
}

export const POMODORO_BUNNY_IMG_CLASS = "w-48 h-48 sm:w-52 sm:h-52";
export const POMODORO_BUNNY_ORIGIN_CLASS = "origin-bottom-right";
export const POMODORO_BUBBLE_WIDTH_CLASS = "w-48 sm:w-56";

export const POMODORO_BUNNY_DEFAULT_CLASS = "absolute right-4 bottom-6 sm:right-8 sm:bottom-8";
