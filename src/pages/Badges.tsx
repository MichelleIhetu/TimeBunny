import { Link } from "react-router-dom";
import { ArrowLeft, Lock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { useAllGoalsForBadges } from "@/hooks/useAllGoalsForBadges";
import {
  computeCategoryBadges,
  BADGES_PER_CATEGORY,
  totalBadgeCount,
  totalUnlockedBadges,
  type CategoryBadge,
} from "@/lib/categoryBadges";

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

function BadgeCard({ badge }: { badge: CategoryBadge }) {
  return (
    <div
      className={`relative border-2 p-4 flex flex-col items-center text-center gap-2 transition-colors h-full min-h-[9.5rem] ${
        badge.unlocked
          ? "bg-white border-[#ddd6fe] shadow-[3px_3px_0px_#a78bfa]"
          : "bg-purple-50/80 border-[#ddd6fe]/70 opacity-80"
      }`}
    >
      <span className="absolute top-2 left-2 text-[7px] text-[#a78bfa]/80" style={PIXEL}>
        #{badge.tier}
      </span>
      {!badge.unlocked && (
        <div className="absolute top-2 right-2 text-[#a78bfa]">
          <Lock className="w-3.5 h-3.5" />
        </div>
      )}

      <span className={`text-3xl leading-none ${badge.unlocked ? "" : "grayscale opacity-50"}`}>{badge.emoji}</span>

      <h3
        className={`text-[8px] leading-relaxed ${badge.unlocked ? "text-[#5b21b6]" : "text-[#a78bfa]"}`}
        style={PIXEL}
      >
        {badge.title}
      </h3>

      <p className="text-sm text-[#a78bfa] leading-snug" style={VT}>
        {badge.unlocked ? badge.tagline : badge.requirement}
      </p>

      {!badge.unlocked && badge.progress > 0 && (
        <div className="w-full mt-1">
          <div className="w-full h-2 bg-purple-100 border border-purple-200 p-px">
            <div className="h-full bg-[#2dd4bf] transition-all" style={{ width: `${Math.round(badge.progress)}%` }} />
          </div>
          <p className="text-[10px] text-[#a78bfa] mt-1" style={VT}>
            {Math.round(badge.progress)}% there
          </p>
        </div>
      )}

      {badge.unlocked && (
        <span className="text-[7px] text-[#2dd4bf] uppercase tracking-wider" style={PIXEL}>
          UNLOCKED
        </span>
      )}
    </div>
  );
}

export default function Badges() {
  const { goals, loading } = useAllGoalsForBadges();
  const groups = computeCategoryBadges(goals);
  const unlocked = totalUnlockedBadges(groups);
  const total = totalBadgeCount();

  return (
    <div className="min-h-screen w-full bg-[#fdfaff] p-4 md:p-8">
      <SEO
        title="Badge Collection — TimeBunny"
        description="Earn category badges like Super Reader and Fitness God as you crush your long-term goals."
        path="/badges"
      />

      <div className="max-w-2xl w-full mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/goals">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-[#5b21b6] hover:bg-purple-100 hover:text-[#5b21b6] text-[10px]"
              style={PIXEL}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              GOALS
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-[#5b21b6]" style={PIXEL}>
            <Award className="w-4 h-4 text-[#2dd4bf]" />
            <span className="text-[9px]">{unlocked}/{total}</span>
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-[#5b21b6] text-lg md:text-xl tracking-tighter" style={PIXEL}>
            BADGE COLLECTION
          </h1>
          <div className="h-1 w-24 bg-[#99f6e4] mx-auto shadow-[2px_2px_0px_#5b21b6]" />
          <p className="text-[#a78bfa] text-base md:text-lg max-w-md mx-auto px-4" style={VT}>
            Scroll each row to collect all {BADGES_PER_CATEGORY} badges per category — from beginner to legend.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border-2 border-[#ddd6fe] p-3 flex flex-col items-center shadow-[4px_4px_0px_#ddd6fe]">
            <span className="text-[9px] text-[#a78bfa] uppercase mb-1" style={PIXEL}>
              Earned
            </span>
            <span className="text-3xl text-[#2dd4bf]" style={VT}>
              {unlocked}
            </span>
          </div>
          <div className="bg-white border-2 border-[#ddd6fe] p-3 flex flex-col items-center shadow-[4px_4px_0px_#ddd6fe]">
            <span className="text-[9px] text-[#a78bfa] uppercase mb-1" style={PIXEL}>
              Total
            </span>
            <span className="text-3xl text-[#5b21b6]" style={VT}>
              {total}
            </span>
          </div>
          <div className="bg-white border-2 border-[#ddd6fe] p-3 flex flex-col items-center shadow-[4px_4px_0px_#ddd6fe]">
            <span className="text-[9px] text-[#a78bfa] uppercase mb-1" style={PIXEL}>
              Goals
            </span>
            <span className="text-3xl text-[#f472b6]" style={VT}>
              {goals.length}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-[#a78bfa] text-lg" style={VT}>
            Loading badges...
          </p>
        ) : goals.length === 0 ? (
          <div className="bg-white border-2 border-[#ddd6fe] p-6 text-center shadow-[4px_4px_0px_#ddd6fe] space-y-3">
            <p className="text-[#5b21b6] text-[10px]" style={PIXEL}>
              NO BADGES YET
            </p>
            <p className="text-[#a78bfa] text-base" style={VT}>
              Plant a goal to start earning badges. Your first fitness goal unlocks Warm-Up Warrior!
            </p>
            <Link to="/goals">
              <Button className="bg-[#5b21b6] text-white text-[10px] hover:bg-[#4c1d95]" style={PIXEL}>
                GO TO GOALS
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.category} className="space-y-3">
                <div className="flex items-center justify-between border-b-2 border-dashed border-[#ddd6fe] pb-2">
                  <h2 className="text-[#5b21b6] text-[10px] flex items-center gap-2" style={PIXEL}>
                    <span>{group.emoji}</span>
                    {group.label.toUpperCase()}
                  </h2>
                  <span className="text-sm text-[#a78bfa]" style={VT}>
                    {group.unlockedCount}/{BADGES_PER_CATEGORY} earned
                  </span>
                </div>
                <div className="relative -mx-1">
                  <div
                    className="flex gap-3 overflow-x-auto pb-3 px-1 snap-x snap-mandatory scroll-smooth"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {group.badges.map((badge) => (
                      <div key={badge.id} className="flex-shrink-0 w-36 sm:w-40 snap-start">
                        <BadgeCard badge={badge} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
