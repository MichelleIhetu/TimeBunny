import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Target, ImageIcon, Sparkles, Clock, Home, Menu, X, Calendar, BookOpen, Award } from "lucide-react";
import JournalBookModal from "./JournalBookModal";

type NavItem = {
  label: string;
  icon: typeof Home;
  onClick: (nav: ReturnType<typeof useNavigate>) => void;
  match: (pathname: string, state: any) => boolean;
};

const items: NavItem[] = [
  { label: "Home", icon: Home, onClick: (nav) => nav("/"), match: (p) => p === "/" },
  {
    label: "Calendar",
    icon: Calendar,
    onClick: (nav) => nav("/welcome-back", { state: { autoScan: true } }),
    match: (p) => p === "/welcome-back",
  },
  {
    label: "Schedule",
    icon: Clock,
    onClick: (nav) => nav("/", { state: { openScheduleView: true } }),
    match: () => false,
  },
  { label: "Goals", icon: Target, onClick: (nav) => nav("/goals"), match: (p) => p === "/goals" },
  { label: "Badges", icon: Award, onClick: (nav) => nav("/badges"), match: (p) => p === "/badges" },
  { label: "Moodboard", icon: ImageIcon, onClick: (nav) => nav("/moodboard"), match: (p) => p === "/moodboard" },
  { label: "Vibe Check", icon: Sparkles, onClick: (nav) => nav("/vibe-check"), match: (p) => p === "/vibe-check" },
];

const HIDDEN_ROUTES = ["/auth"];
const POS_KEY = "timebunny_floating_nav_pos";
const BTN = 44;
const MARGIN = 16;

function loadPos(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 16, y: 16 };
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch {}
  // Default: bottom-left
  return { x: MARGIN, y: Math.max(MARGIN, window.innerHeight - BTN - MARGIN) };
}

export default function FloatingNav() {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const [open, setOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() =>
    typeof window === "undefined" ? { x: 16, y: 16 } : loadPos(),
  );
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);

  // Keep in-viewport on resize
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - BTN - MARGIN),
        y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - BTN - MARGIN),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (HIDDEN_ROUTES.includes(pathname)) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
      pointerId: e.pointerId,
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (d.moved) {
      const nx = Math.min(Math.max(MARGIN, d.origX + dx), window.innerWidth - BTN - MARGIN);
      const ny = Math.min(Math.max(MARGIN, d.origY + dy), window.innerHeight - BTN - MARGIN);
      setPos({ x: nx, y: ny });
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (d?.moved) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {}
    } else {
      setOpen((o) => !o);
    }
  };

  // Decide panel placement so it stays on-screen
  const panelBelow = pos.y < window.innerHeight / 2;
  const panelRight = pos.x < window.innerWidth / 2;

  return (
    <div
      className="fixed z-[60] print:hidden"
      style={{
        left: pos.x,
        top: pos.y,
        touchAction: "none",
      }}
    >
      <div className="relative">
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          title="Drag to move, tap to open"
          className="flex items-center justify-center w-11 h-11 rounded-full shadow-lg text-white transition-transform hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing select-none"
          style={{ background: "hsl(280 55% 55%)" }}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {open && (
          <nav
            className="absolute flex flex-col gap-1.5 p-2 rounded-2xl shadow-xl bg-white/95 backdrop-blur border"
            style={{
              borderColor: "hsl(280 40% 80%)",
              minWidth: "11rem",
              [panelBelow ? "top" : "bottom"]: BTN + 8,
              [panelRight ? "left" : "right"]: 0,
            } as React.CSSProperties}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname, state);
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    item.onClick(navigate);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: active ? "hsl(280 55% 55%)" : "hsl(280 30% 95%)",
                    color: active ? "white" : "hsl(280 40% 25%)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => {
                setJournalOpen(true);
                setOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "hsl(30 60% 92%)",
                color: "hsl(25 45% 25%)",
                fontFamily: "var(--font-body)",
              }}
            >
              <BookOpen className="w-4 h-4" />
              <span>Journal</span>
            </button>
          </nav>
        )}
      </div>
      <JournalBookModal open={journalOpen} onClose={() => setJournalOpen(false)} />
    </div>
  );
}
