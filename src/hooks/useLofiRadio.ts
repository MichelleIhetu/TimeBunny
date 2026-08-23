import { useCallback, useEffect, useRef, useState } from "react";
import { LOFI_TRACKS, LOFI_VOLUME, type LofiTrack } from "@/lib/lofiTracks";

function pickNextTrack(excludeId?: string): LofiTrack {
  const pool =
    excludeId && LOFI_TRACKS.length > 1
      ? LOFI_TRACKS.filter((t) => t.id !== excludeId)
      : LOFI_TRACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function useLofiRadio(active: boolean) {
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<LofiTrack | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
    currentTrackIdRef.current = null;
    setCurrentTrack(null);
    setPlaying(false);
  }, []);

  const playTrack = useCallback(
    (track: LofiTrack) => {
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audio.volume = LOFI_VOLUME;
        audioRef.current = audio;

        audio.addEventListener("ended", () => {
          const next = pickNextTrack(currentTrackIdRef.current ?? undefined);
          currentTrackIdRef.current = next.id;
          setCurrentTrack(next);
          audio!.src = next.src;
          audio!.volume = LOFI_VOLUME;
          void audio!.play().catch(() => setPlaying(false));
        });
      }

      currentTrackIdRef.current = track.id;
      setCurrentTrack(track);
      audio.src = track.src;
      audio.volume = LOFI_VOLUME;
      void audio.play().catch(() => setPlaying(false));
    },
    [],
  );

  const toggle = useCallback(() => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    const track = currentTrack ?? pickNextTrack();
    playTrack(track);
  }, [currentTrack, playTrack, playing]);

  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  useEffect(() => stop, [stop]);

  return { playing, toggle, currentTrack, stop };
}
