import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  Calendar,
  Clock,
  Home,
  ImageIcon,
  MoreHorizontal,
  Sparkles,
  Target,
  BookOpen,
} from "lucide-react";
import JournalBookModal from "@/components/JournalBookModal";
import {
  APP_NAV_ITEMS,
  MOBILE_MORE_NAV,
  MOBILE_PRIMARY_NAV,
  type AppNavEntry,
  type NavAction,
} from "@/lib/appNavigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

const HIDDEN_ROUTES = ["/auth", "/calendar-success"];

function runNavAction(action: NavAction, navigate: ReturnType<typeof useNavigate>, openJournal: () => void) {
  if (action.type === "journal") {
    openJournal();
    return;
  }
  if (action.type === "route") {
    navigate(action.path, action.state ? { state: action.state } : undefined);
  }
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: AppNavEntry;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = ICONS[item.id] ?? Home;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-1"
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
    >
      <span
        className={[
          "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
          active ? "text-white" : "text-[hsl(280_35%_45%)]",
        ].join(" ")}
        style={active ? { background: "hsl(280 55% 55%)" } : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
      </span>
      <span
        className={[
          "text-[10px] font-semibold truncate max-w-full px-0.5",
          active ? "text-[hsl(280_55%_45%)]" : "text-[hsl(280_30%_50%)]",
        ].join(" ")}
        style={{ fontFamily: "var(--font-body)" }}
      >
        {item.label}
      </span>
    </button>
  );
}

export default function MobileTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [journalOpen, setJournalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  if (HIDDEN_ROUTES.includes(pathname)) return null;

  const openJournal = () => setJournalOpen(true);

  const handleItem = (item: AppNavEntry) => {
    runNavAction(item.action, navigate, openJournal);
    setMoreOpen(false);
  };

  const moreActive = MOBILE_MORE_NAV.some((item) => item.match(pathname));

  return (
    <>
      <nav
        className="mobile-tab-bar fixed inset-x-0 bottom-0 z-[60] print:hidden border-t bg-white/95 backdrop-blur-md"
        style={{ borderColor: "hsl(280 40% 88%)" }}
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-1 pt-1">
          {MOBILE_PRIMARY_NAV.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={item.match(pathname)}
              onClick={() => handleItem(item)}
            />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-1"
            aria-label="More navigation"
            aria-expanded={moreOpen}
          >
            <span
              className={[
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                moreActive ? "text-white" : "text-[hsl(280_35%_45%)]",
              ].join(" ")}
              style={moreActive ? { background: "hsl(280 55% 55%)" } : undefined}
            >
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span
              className="text-[10px] font-semibold text-[hsl(280_30%_50%)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle style={{ fontFamily: "var(--font-body)" }}>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {MOBILE_MORE_NAV.map((item) => {
              const Icon = ICONS[item.id] ?? Home;
              const active = item.match(pathname);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItem(item)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                  style={{
                    background: active ? "hsl(280 55% 55%)" : "hsl(280 30% 96%)",
                    color: active ? "white" : "hsl(280 40% 25%)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="font-semibold text-sm">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                openJournal();
              }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-left"
              style={{
                background: "hsl(30 60% 92%)",
                color: "hsl(25 45% 25%)",
                fontFamily: "var(--font-body)",
              }}
            >
              <BookOpen className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-sm">Journal</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <JournalBookModal open={journalOpen} onClose={() => setJournalOpen(false)} />
    </>
  );
}
