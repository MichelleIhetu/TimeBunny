const ORANGE = "#F7941D";
const ORANGE_DARK = "#D97814";
const GREEN = "#5CB535";
const GREEN_DARK = "#3A8F2E";

/** Tapered root — rounded top, pointed bottom. */
const CARROT_BODY =
  "M24 28 C35 28 40 36 39 46 C38 56 33 65 24 70 C15 65 10 56 9 46 C8 36 13 28 24 28 Z";

/** Short horizontal root scars, alternating sides. */
const GROOVES = [
  "M13 40 C16 41 18.5 41 21 40",
  "M27 40 C30 41 32.5 41 35 40",
  "M12 47 C15 48 17.5 48 20 47",
  "M28 47 C31 48 33.5 48 36 47",
  "M13 54 C16 55 18.5 55 21 54",
  "M27 54 C30 55 32.5 55 35 54",
];

type Sprig = { stem: string; leaf: string };

/** Three sprigs — center upright, two angled outward. */
const SPRIGS: Sprig[] = [
  {
    stem: "M24 28 L24 16",
    leaf:
      "M24 5 C19 5 15 8.5 15 13 C15 17 18.5 20 24 20 C29.5 20 33 17 33 13 C33 8.5 29 5 24 5 Z",
  },
  {
    stem: "M24 28 C20 25 16 22 12 21",
    leaf:
      "M4 13 C1 13 -1 16 0 19.5 C1 23 4 25 7.5 24.5 C11 24 13 21 12.5 17.5 C12 14 8 13 4 13 Z",
  },
  {
    stem: "M24 28 C28 25 32 22 36 21",
    leaf:
      "M44 13 C47 13 49 16 48 19.5 C47 23 44 25 40.5 24.5 C37 24 35 21 35.5 17.5 C36 14 40 13 44 13 Z",
  },
];

export default function CarrotIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 72" className={className} aria-hidden>
      <defs>
        <clipPath id="carrot-right-shade">
          <rect x="24" y="0" width="24" height="72" />
        </clipPath>
      </defs>

      {SPRIGS.map(({ stem, leaf }, i) => (
        <g key={i}>
          <path d={stem} stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path
            d={stem}
            stroke={GREEN_DARK}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            clipPath="url(#carrot-right-shade)"
          />
          <path d={leaf} fill={GREEN} />
          <path d={leaf} fill={GREEN_DARK} clipPath="url(#carrot-right-shade)" />
        </g>
      ))}

      <path d={CARROT_BODY} fill={ORANGE} />
      <path d={CARROT_BODY} fill={ORANGE_DARK} clipPath="url(#carrot-right-shade)" />

      {GROOVES.map((d, i) => (
        <path key={i} d={d} stroke={ORANGE_DARK} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      ))}
    </svg>
  );
}
