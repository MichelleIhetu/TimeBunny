import { useCallback, useEffect, useRef, useState } from "react";
import { LOFI_TRACKS, LOFI_VOLUME, type LofiTrack } from "@/lib/lofiTracks";

const FADE_SECONDS = 0.35;
const CROSSFADE_SECONDS = 1.4;
const STALL_RETRY_MS = 2200;

function pickNextTrack(excludeId?: string | null): LofiTrack {
  const pool =
    excludeId && LOFI_TRACKS.length > 1
      ? LOFI_TRACKS.filter((t) => t.id !== excludeId)
      : LOFI_TRACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeElement(): HTMLAudioElement {
  const el = new Audio();
  el.preload = "auto";
  el.playsInline = true;
  el.loop = false;
  el.volume = 1;
  return el;
}

type Slot = {
  el: HTMLAudioElement;
  gain: GainNode | null;
  source: MediaElementAudioSourceNode | null;
};

function rampGain(gain: GainNode | null, ctx: AudioContext | null, el: HTMLAudioElement, to: number, seconds: number) {
  if (gain && ctx) {
    const now = ctx.currentTime;
    const from = Math.max(gain.gain.value, 0.0001);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(from, now);
    gain.gain.linearRampToValueAtTime(Math.max(to, 0.0001), now + Math.max(seconds, 0.05));
    return;
  }
  el.volume = Math.min(1, Math.max(0, to === 1 ? LOFI_VOLUME : to * LOFI_VOLUME));
}

export function useLofiRadio(active: boolean) {
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<LofiTrack | null>(null);

  const playingRef = useRef(false);
  const activeRef = useRef(active);
  const currentTrackRef = useRef<LofiTrack | null>(null);
  const crossfadingRef = useRef(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const currentSlotRef = useRef<Slot | null>(null);
  const nextSlotRef = useRef<Slot | null>(null);
  const skipRef = useRef<() => Promise<boolean>>(async () => false);
  const attachRef = useRef<(slot: Slot) => void>(() => {});

  const setPlayingBoth = useCallback((value: boolean) => {
    playingRef.current = value;
    setPlaying(value);
  }, []);

  const setTrackBoth = useCallback((track: LofiTrack | null) => {
    currentTrackRef.current = track;
    setCurrentTrack(track);
  }, []);

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const ensureGraph = useCallback(async () => {
    if (ctxRef.current?.state === "closed") {
      ctxRef.current = null;
      filterRef.current = null;
      masterRef.current = null;
      currentSlotRef.current = null;
      nextSlotRef.current = null;
    }
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      // Softens harsh MP3 crackle / hiss without dulling the music.
      filter.frequency.value = 12000;
      filter.Q.value = 0.7;
      const master = ctx.createGain();
      master.gain.value = LOFI_VOLUME;
      filter.connect(master);
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      filterRef.current = filter;
      masterRef.current = master;
    }
    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const makeSlot = useCallback(
    (ctx: AudioContext): Slot => {
      const el = makeElement();
      let source: MediaElementAudioSourceNode | null = null;
      let gain: GainNode | null = null;
      try {
        source = ctx.createMediaElementSource(el);
        gain = ctx.createGain();
        gain.gain.value = 0.0001;
        source.connect(gain);
        if (filterRef.current) gain.connect(filterRef.current);
      } catch {
        el.volume = LOFI_VOLUME;
      }
      const slot = { el, gain, source };
      attachRef.current(slot);
      return slot;
    },
    [],
  );

  const preloadTrack = useCallback((slot: Slot, track: LofiTrack) => {
    const current = slot.el.getAttribute("src") || "";
    if (current === track.src || current.endsWith(track.src)) return;
    slot.el.pause();
    slot.el.src = track.src;
    slot.el.load();
  }, []);

  const waitUntilReady = useCallback((el: HTMLAudioElement) => {
    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve();
        else reject(new Error("lofi buffer timeout"));
      }, 8000);
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(el.error ?? new Error("lofi audio failed"));
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        el.removeEventListener("canplaythrough", onReady);
        el.removeEventListener("canplay", onReady);
        el.removeEventListener("error", onError);
      };
      el.addEventListener("canplaythrough", onReady, { once: true });
      el.addEventListener("canplay", onReady, { once: true });
      el.addEventListener("error", onError, { once: true });
    });
  }, []);

  const armNext = useCallback(
    (ctx: AudioContext, excludeId?: string | null) => {
      const nextTrack = pickNextTrack(excludeId);
      let slot = nextSlotRef.current;
      if (!slot) {
        slot = makeSlot(ctx);
        nextSlotRef.current = slot;
      }
      slot.el.dataset.trackId = nextTrack.id;
      preloadTrack(slot, nextTrack);
      return nextTrack;
    },
    [makeSlot, preloadTrack],
  );

  const fadeOutAndPause = useCallback(
    (slot: Slot | null) => {
      const ctx = ctxRef.current;
      if (!slot || !ctx) return;
      rampGain(slot.gain, ctx, slot.el, 0.0001, FADE_SECONDS);
      window.setTimeout(() => {
        if (!playingRef.current) slot.el.pause();
      }, FADE_SECONDS * 1000 + 40);
    },
    [],
  );

  const stop = useCallback(() => {
    clearStallTimer();
    crossfadingRef.current = false;
    const ctx = ctxRef.current;
    const current = currentSlotRef.current;
    const next = nextSlotRef.current;
    if (ctx && current) rampGain(current.gain, ctx, current.el, 0.0001, 0.12);
    if (ctx && next) rampGain(next.gain, ctx, next.el, 0.0001, 0.12);
    current?.el.pause();
    next?.el.pause();
    setPlayingBoth(false);
    setTrackBoth(null);
  }, [clearStallTimer, setPlayingBoth, setTrackBoth]);

  const playOnSlot = useCallback(
    async (slot: Slot, track: LofiTrack, fadeSeconds: number) => {
      const ctx = await ensureGraph();
      slot.el.dataset.trackId = track.id;
      if (!slot.el.getAttribute("src")?.endsWith(track.src) || slot.el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        preloadTrack(slot, track);
        await waitUntilReady(slot.el);
      }
      rampGain(slot.gain, ctx, slot.el, 1, fadeSeconds);
      await slot.el.play();
      setTrackBoth(track);
      setPlayingBoth(true);
    },
    [ensureGraph, preloadTrack, setPlayingBoth, setTrackBoth, waitUntilReady],
  );

  const skipToPreloaded = useCallback(async () => {
    if (crossfadingRef.current) return false;
    const ctx = ctxRef.current;
    const nextSlot = nextSlotRef.current;
    const currentSlot = currentSlotRef.current;
    if (!ctx || !nextSlot) return false;
    crossfadingRef.current = true;
    const nextId = nextSlot.el.dataset.trackId;
    const nextTrack = LOFI_TRACKS.find((t) => t.id === nextId) ?? pickNextTrack(currentTrackRef.current?.id);
    try {
      if (currentSlot) rampGain(currentSlot.gain, ctx, currentSlot.el, 0.0001, CROSSFADE_SECONDS);
      await playOnSlot(nextSlot, nextTrack, CROSSFADE_SECONDS);
      if (currentSlot) {
        window.setTimeout(() => currentSlot.el.pause(), CROSSFADE_SECONDS * 1000 + 80);
      }
      currentSlotRef.current = nextSlot;
      nextSlotRef.current = currentSlot ?? makeSlot(ctx);
      armNext(ctx, nextTrack.id);
      crossfadingRef.current = false;
      return true;
    } catch {
      crossfadingRef.current = false;
      return false;
    }
  }, [armNext, makeSlot, playOnSlot]);

  const onStall = useCallback((event: Event) => {
    if (!playingRef.current) return;
    if (event.target !== currentSlotRef.current?.el) return;
    clearStallTimer();
    stallTimerRef.current = setTimeout(() => {
      if (!playingRef.current || !activeRef.current) return;
      const current = currentSlotRef.current?.el;
      if (current && current.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        void current.play().catch(() => {
          void skipRef.current();
        });
        return;
      }
      void skipRef.current();
    }, STALL_RETRY_MS);
  }, [clearStallTimer]);

  const attachTransportListeners = useCallback(
    (slot: Slot) => {
      const el = slot.el;
      el.addEventListener("waiting", onStall);
      el.addEventListener("stalled", onStall);
      el.addEventListener("playing", () => {
        if (currentSlotRef.current?.el === el) clearStallTimer();
      });
      el.addEventListener("canplay", () => {
        if (currentSlotRef.current?.el === el) clearStallTimer();
      });
      el.addEventListener("error", () => {
        if (playingRef.current && currentSlotRef.current?.el === el) void skipRef.current();
      });
      el.addEventListener("ended", () => {
        if (!playingRef.current || !activeRef.current) return;
        if (currentSlotRef.current?.el !== el) return;
        void skipRef.current();
      });
      el.addEventListener("timeupdate", () => {
        if (currentSlotRef.current?.el !== el) return;
        if (!playingRef.current || crossfadingRef.current) return;
        if (!el.duration || !Number.isFinite(el.duration)) return;
        if (el.duration - el.currentTime <= CROSSFADE_SECONDS) {
          void skipRef.current();
        }
      });
    },
    [clearStallTimer],
  );

  skipRef.current = skipToPreloaded;
  attachRef.current = attachTransportListeners;

  const startFresh = useCallback(
    async (track: LofiTrack) => {
      const ctx = await ensureGraph();
      let slot = currentSlotRef.current;
      if (!slot) {
        slot = makeSlot(ctx);
        currentSlotRef.current = slot;
      }
      if (!nextSlotRef.current) {
        nextSlotRef.current = makeSlot(ctx);
      }
      await playOnSlot(slot, track, FADE_SECONDS);
      armNext(ctx, track.id);
    },
    [armNext, ensureGraph, makeSlot, playOnSlot],
  );

  const toggle = useCallback(async () => {
    if (!activeRef.current) return;

    if (playingRef.current) {
      fadeOutAndPause(currentSlotRef.current);
      setPlayingBoth(false);
      return;
    }

    try {
      await ensureGraph();
      const slot = currentSlotRef.current;
      const track = currentTrackRef.current;
      // Resume in place — do not reload src (that causes crackle / static).
      if (slot && track && slot.el.src && !slot.el.ended && slot.el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          rampGain(slot.gain, ctxRef.current, slot.el, 1, FADE_SECONDS);
          await slot.el.play();
          setPlayingBoth(true);
          return;
        } catch {
          currentSlotRef.current = null;
          nextSlotRef.current = null;
        }
      }
      await startFresh(track ?? pickNextTrack());
    } catch {
      setPlayingBoth(false);
    }
  }, [ensureGraph, fadeOutAndPause, setPlayingBoth, startFresh]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) stop();
  }, [active, stop]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !playingRef.current) return;
      void ctxRef.current?.resume();
      const el = currentSlotRef.current?.el;
      if (el && el.paused) void el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(
    () => () => {
      clearStallTimer();
      currentSlotRef.current?.el.pause();
      nextSlotRef.current?.el.pause();
      currentSlotRef.current?.el.removeAttribute("src");
      nextSlotRef.current?.el.removeAttribute("src");
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    },
    [clearStallTimer],
  );

  return { playing, toggle, currentTrack, stop };
}
