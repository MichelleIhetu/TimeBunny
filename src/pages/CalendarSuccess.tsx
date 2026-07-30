import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Calendar, ArrowRight, CheckCircle2 } from "lucide-react";
import SEO from "@/components/SEO";
import bunnyMascot from "@/assets/bunny-mascot.png";
import { localDateString } from "@/lib/localTime";

export type CalendarSuccessState = {
  eventCount: number;
  scopeLabel: string;
  returnTo: string;
  events: Array<Record<string, unknown>>;
  todayStr: string;
};

export const CALENDAR_SUCCESS_STORAGE_KEY = "timebunny_calendar_success";

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

export const saveCalendarSuccessState = (state: CalendarSuccessState) => {
  sessionStorage.setItem(CALENDAR_SUCCESS_STORAGE_KEY, JSON.stringify(state));
};

export const loadCalendarSuccessState = (): CalendarSuccessState | null => {
  try {
    const raw = sessionStorage.getItem(CALENDAR_SUCCESS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalendarSuccessState) : null;
  } catch {
    return null;
  }
};

const CalendarSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isPreview = new URLSearchParams(location.search).get("preview") === "1";

  const state = useMemo(() => {
    const fromNav = location.state as CalendarSuccessState | null;
    if (fromNav?.events?.length) return fromNav;
    if (isPreview) {
      return {
        eventCount: 12,
        scopeLabel: "the next 31 days",
        returnTo: "/",
        events: [{ id: "preview", title: "Preview event" }],
        todayStr: localDateString(),
      } satisfies CalendarSuccessState;
    }
    return loadCalendarSuccessState();
  }, [location.state, isPreview]);

  useEffect(() => {
    const fromNav = location.state as CalendarSuccessState | null;
    if (fromNav?.events?.length) saveCalendarSuccessState(fromNav);
  }, [location.state]);

  const eventCount = state?.eventCount ?? 0;
  const scopeLabel = state?.scopeLabel ?? "your calendar";
  const returnTo = state?.returnTo ?? "/";

  const handleContinue = () => {
    if (!state?.events?.length) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate(returnTo, {
      replace: true,
      state: {
        calendarContinue: true,
        events: state.events,
        todayStr: state.todayStr,
        scopeLabel: state.scopeLabel,
      },
    });
  };

  const pageShell = (children: React.ReactNode) => (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-[#fdf4ff] px-4 py-10">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#ddd6fe 1px, transparent 1px), linear-gradient(90deg, #ddd6fe 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );

  if (!state?.events?.length) {
    return pageShell(
      <>
        <SEO title="Calendar — TimeBunny" description="Calendar sync confirmation" path="/calendar-success" />
        <div className="bg-white border-2 border-[#5b21b6] shadow-[6px_6px_0px_#a78bfa] p-6 text-center space-y-5">
          <h2 className="text-[#5b21b6] text-[11px] leading-relaxed" style={PIXEL}>
            NO CALENDAR DATA YET
          </h2>
          <p className="text-[#a78bfa] text-lg leading-snug" style={VT}>
            Sign in with Google, then tap <strong className="text-[#5b21b6]">My Calendar</strong> on the home page.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-1">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-5 py-3 text-[10px] text-white bg-[#5b21b6] border-2 border-[#5b21b6] shadow-[3px_3px_0px_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              style={PIXEL}
            >
              GO HOME
            </Link>
            <Link
              to="/calendar-success?preview=1"
              className="inline-flex items-center justify-center px-5 py-3 text-[10px] text-[#5b21b6] bg-white border-2 border-[#5b21b6] shadow-[3px_3px_0px_#5b21b6] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              style={PIXEL}
            >
              PREVIEW
            </Link>
          </div>
        </div>
      </>,
    );
  }

  return pageShell(
    <>
      <SEO
        title="Calendar synced — TimeBunny"
        description="Your Google Calendar events were fetched successfully."
        path="/calendar-success"
      />

      <div className="flex justify-center mb-[-24px] relative z-20">
        <img
          src={bunnyMascot}
          alt="TimeBunny celebrating a successful calendar sync"
          className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-[3px_3px_0px_#a78bfa] pixel-img"
          draggable={false}
        />
      </div>

      <div className="bg-white border-2 border-[#5b21b6] shadow-[6px_6px_0px_#a78bfa] p-6 space-y-5">
        <div className="text-center space-y-2">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-[#99f6e4] bg-[#ecfdf5] text-[#047857] text-lg"
            style={VT}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Calendar connected
          </div>

          <h1 className="text-[#5b21b6] text-[13px] leading-relaxed pt-2" style={PIXEL}>
            CALENDAR SYNCED!
          </h1>
          <div className="h-1 w-16 bg-[#99f6e4] mx-auto shadow-[2px_2px_0px_#5b21b6]" />

          <p className="text-[#a78bfa] text-xl leading-snug" style={VT}>
            TimeBunny fetched{" "}
            <strong className="text-[#5b21b6]">{eventCount}</strong> upcoming event
            {eventCount === 1 ? "" : "s"} from{" "}
            <strong className="text-[#5b21b6]">{scopeLabel}</strong>.
          </p>
        </div>

        <div className="border-2 border-[#ddd6fe] bg-[#faf5ff] px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-[#5b21b6] text-[10px]" style={PIXEL}>
            <Calendar className="w-4 h-4 shrink-0" />
            READY FOR ANALYSIS
          </div>
          <p className="text-[#7c6a9a] text-lg leading-snug" style={VT}>
            Your events are saved. Continue to turn them into a focused plan for your day.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full flex items-center justify-center gap-2 bg-[#5b21b6] text-white px-4 py-3 text-[11px] border-2 border-[#5b21b6] shadow-[3px_3px_0px_#a78bfa] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            style={PIXEL}
          >
            CONTINUE
            <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            to={returnTo}
            className="w-full flex items-center justify-center px-4 py-2 text-[#a78bfa] hover:text-[#5b21b6] transition-colors text-xl"
            style={VT}
          >
            back
          </Link>
        </div>
      </div>
    </>,
  );
};

export default CalendarSuccess;
