/** Royalty-free lofi tracks (Mixkit Free License — mixkit.co/license/#musicFree) */
export type LofiTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  sourceUrl: string;
};

export const LOFI_TRACKS: LofiTrack[] = [
  {
    id: "sweet-september",
    title: "Sweet September",
    artist: "Arulo",
    src: "/audio/lofi/sweet-september.mp3",
    sourceUrl: "https://mixkit.co/free-stock-music/instrumental/282/",
  },
  {
    id: "sleepy-cat",
    title: "Sleepy Cat",
    artist: "Alejandro Magaña (A. M.)",
    src: "/audio/lofi/sleepy-cat.mp3",
    sourceUrl: "https://mixkit.co/free-stock-music/instrumental/135/",
  },
];

export const LOFI_VOLUME = 0.38;
