import { useId, useMemo } from "react";
import { motion } from "framer-motion";

/** TimeBunny Goals palette + kawaii blush */
const PURPLE = "#5b21b6";
const LAVENDER = "#a78bfa";
const BORDER = "#ddd6fe";
const TEAL = "#2dd4bf";
const TEAL_DARK = "#14b8a6";
const ORANGE = "#FB923C";
const ORANGE_LIGHT = "#FED7AA";
const BLUSH = "#f472b6";
const SOIL = "#EDE9FE";
const ROOT = "#C4B5FD";

/** Chubby kawaii body — crown at (0,0). */
const BODY =
  "M0 0 C6.5 0 10 4 10 16 C10.5 30 10 44 9 58 C8 70 4.5 76 0 78 C-4.5 76 -8 70 -9 58 C-10 44 -10.5 30 -10 16 C-10 4 -6.5 0 0 0 Z";

type RootDef = { d: string; at: number };

const ROOTS: RootDef[] = [
  { d: "M-5 12 Q-10 22 -12 30", at: 0.1 },
  { d: "M5 13 Q10 23 12 31", at: 0.12 },
  { d: "M-6 22 Q-12 34 -14 42", at: 0.22 },
  { d: "M6 23 Q12 35 14 43", at: 0.24 },
  { d: "M-4 32 Q-9 44 -10 52", at: 0.35 },
  { d: "M4 33 Q9 45 10 53", at: 0.37 },
  { d: "M0 38 Q-3 50 -3 58", at: 0.42 },
  { d: "M0 39 Q3 51 3 59", at: 0.44 },
];

const LEAF_PUFFS: { cx: number; cy: number; rx: number; ry: number; at: number }[] = [
  { cx: -5, cy: -7, rx: 4.5, ry: 5, at: 0.08 },
  { cx: 5, cy: -7, rx: 4.5, ry: 5, at: 0.1 },
  { cx: 0, cy: -11, rx: 4, ry: 4.5, at: 0.18 },
  { cx: -3, cy: -13, rx: 3, ry: 3.5, at: 0.28 },
  { cx: 3, cy: -13, rx: 3, ry: 3.5, at: 0.3 },
];

type Growth = { scale: number; rootT: number; leafT: number; faceT: number };

function useGrowth(progress: number): Growth {
  return useMemo(() => {
    const t = Math.min(1, Math.max(0, progress / 100));
    return {
      scale: 0.15 + t * 0.85,
      rootT: Math.min(1, Math.max(0, (t - 0.06) / 0.88)),
      leafT: Math.min(1, Math.max(0, (t - 0.05) / 0.9)),
      faceT: Math.min(1, Math.max(0, (t - 0.15) / 0.75)),
    };
  }, [progress]);
}

function KawaiiFace({ happy, opacity }: { happy: boolean; opacity: number }) {
  return (
    <g opacity={opacity}>
      <ellipse cx="-4.5" cy="22" rx="2.8" ry="1.6" fill={BLUSH} opacity="0.75" />
      <ellipse cx="4.5" cy="22" rx="2.8" ry="1.6" fill={BLUSH} opacity="0.75" />
      {happy ? (
        <>
          <path d="M-3.5 18 Q-2.5 16.5 -1.5 18" stroke={PURPLE} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M1.5 18 Q2.5 16.5 3.5 18" stroke={PURPLE} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M-2 26 Q0 29 2 26" stroke={PURPLE} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="-2.5" cy="18" r="1.7" fill={PURPLE} />
          <circle cx="2.5" cy="18" r="1.7" fill={PURPLE} />
          <circle cx="-2.2" cy="17.5" r="0.55" fill="white" />
          <circle cx="2.8" cy="17.5" r="0.55" fill="white" />
          <path d="M-1.5 25 Q0 26.5 1.5 25" stroke={PURPLE} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function CarrotSprite({
  growth,
  showRoots,
  soilLine,
  complete,
}: {
  growth: Growth;
  showRoots: boolean;
  soilLine: number;
  complete: boolean;
}) {
  const undergroundId = useId();

  return (
    <svg viewBox="0 0 56 72" className="h-full w-full" aria-hidden>
      <defs>
        <clipPath id={undergroundId}>
          <rect x="0" y={soilLine} width="56" height="40" />
        </clipPath>
      </defs>

      {!complete && (
        <>
          <rect x="0" y={soilLine} width="56" height={72 - soilLine} fill={SOIL} />
          <line x1="0" y1={soilLine} x2="56" y2={soilLine} stroke={BORDER} strokeWidth="2" />
        </>
      )}

      <g transform={`translate(28 ${complete ? 12 : soilLine - 2})`}>
        <motion.g
          style={{ transformOrigin: "0px 0px" }}
          animate={{ scale: growth.scale }}
          transition={{ type: "spring", stiffness: 130, damping: 17 }}
        >
          <g>
            {LEAF_PUFFS.filter((l) => growth.leafT >= l.at).map((l, i) => (
              <ellipse
                key={i}
                cx={l.cx}
                cy={l.cy}
                rx={l.rx}
                ry={l.ry}
                fill={TEAL}
                stroke={TEAL_DARK}
                strokeWidth="0.9"
                opacity={Math.min(1, (growth.leafT - l.at) / 0.1 + 0.45)}
              />
            ))}
          </g>

          <path d={BODY} fill={ORANGE} stroke={PURPLE} strokeWidth="1.4" strokeLinejoin="round" />
          <ellipse cx="-2" cy="28" rx="2.5" ry="5" fill={ORANGE_LIGHT} opacity="0.65" />

          <KawaiiFace happy={complete} opacity={growth.faceT} />

          {complete && (
            <motion.text
              x="7"
              y="-14"
              fontSize="7"
              fill={LAVENDER}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              ✦
            </motion.text>
          )}
        </motion.g>
      </g>

      {showRoots && (
        <g clipPath={`url(#${undergroundId})`}>
          <g transform={`translate(28 ${soilLine + 4}) scale(${growth.scale})`}>
            {ROOTS.filter((r) => growth.rootT >= r.at).map((r, i) => (
              <path
                key={i}
                d={r.d}
                stroke={ROOT}
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
                opacity={Math.min(1, (growth.rootT - r.at) / 0.08 + 0.5)}
              />
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}

type Props = {
  progress: number;
  className?: string;
};

export default function GrowingCarrot({ progress, className = "" }: Props) {
  const complete = progress >= 100;
  const growth = useGrowth(progress);
  const soilLine = 28;

  return (
    <div
      className={`relative w-14 h-[4.75rem] border-2 bg-white overflow-hidden flex-shrink-0 ${
        complete ? "border-[#2dd4bf] shadow-[2px_2px_0px_#2dd4bf]" : "border-[#ddd6fe] shadow-[2px_2px_0px_#a78bfa]"
      } ${className}`}
      aria-hidden
    >
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-purple-100"
        animate={{ height: `${Math.max(8, progress)}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-[#2dd4bf]/25"
        animate={{ height: `${Math.max(4, progress * 0.85)}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      />

      <motion.div
        className="relative h-full w-full"
        animate={{ y: complete ? -4 : 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 20 }}
      >
        <CarrotSprite growth={growth} showRoots={!complete} soilLine={soilLine} complete={complete} />
      </motion.div>

      {complete && (
        <div
          className="absolute top-0.5 left-0 right-0 text-center text-[6px] text-[#2dd4bf] font-bold leading-none pointer-events-none"
          style={{ fontFamily: "'Press Start 2P', cursive" }}
        >
          ✓
        </div>
      )}
    </div>
  );
}

export function CarrotBadgeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" className={className} aria-hidden>
      <g transform="translate(12 5) scale(0.52)">
        {LEAF_PUFFS.map((l, i) => (
          <ellipse key={i} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} fill={TEAL} stroke={TEAL_DARK} strokeWidth="0.9" />
        ))}
        <path d={BODY} fill={ORANGE} stroke={PURPLE} strokeWidth="1.4" />
        <KawaiiFace happy opacity={1} />
      </g>
    </svg>
  );
}
