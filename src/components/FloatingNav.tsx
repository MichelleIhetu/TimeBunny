import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Target,
  ImageIcon,
  Sparkles,
  Clock,
  Home,
  Menu,
  X,
  Calendar,
  BookOpen,
  Award,
} from "lucide-react";
import JournalBookModal from "./JournalBookModal";
import { APP_NAV_ITEMS, type AppNavEntry, type NavAction } from "@/lib/appNavigation";

const ICONS: Record<string, typeof Home> = {
  home: Home,
  calendar: Calendar,
  schedule: Clock,
  goals: Target,
  badges: Award,
  moodboard: ImageIcon,
  vibe: Sparkles,
  journal: BookOpen,
};

function runNavAction(action: NavAction, navigate: ReturnType<typeof useNavigate>, openJournal: () => void) {
  if (action.type === "journal") {
    openJournal();
    return;
  }
  if (action.type === "route") {
    navigate(action.path, action.state ? { state: action.state } : undefined);
  }
}

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
  return { x: MARGIN, y: Math.max(MARGIN, window.innerHeight - BTN - MARGIN) };
}

export default function FloatingNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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

  const panelBelow = pos.y < window.innerHeight / 2;
  const panelRight = pos.x < window.innerWidth / 2;

  const handleItem = (item: AppNavEntry) => {
    runNavAction(item.action, navigate, () => setJournalOpen(true));
    setOpen(false);
  };

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
            {APP_NAV_ITEMS.map((item) => {
              const Icon = ICONS[item.id] ?? Home;
              const active = item.match(pathname);
              return (
                <button
                  key={item.id}
                  onClick={() => handleItem(item)}
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
          </nav>
        )}
      </div>
      <JournalBookModal open={journalOpen} onClose={() => setJournalOpen(false)} />
    </div>
  );
}
