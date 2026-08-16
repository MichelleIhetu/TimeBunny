import type { GoalWithProgress } from "@/hooks/useGoals";
import { isGoalComplete } from "@/lib/goalCarrots";
import { isReadingCategory } from "@/lib/goalUnits";

export type GoalCategory =
  | "fitness"
  | "learning"
  | "reading"
  | "creative"
  | "career"
  | "wellness"
  | "general";

export const BADGES_PER_CATEGORY = 20;

export type BadgeTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export interface CategoryBadgeDef {
  id: string;
  category: GoalCategory;
  tier: BadgeTier;
  title: string;
  emoji: string;
  tagline: string;
  requirement: string;
}

export interface CategoryBadge extends CategoryBadgeDef {
  unlocked: boolean;
  progress: number;
}

export interface CategoryBadgeGroup {
  category: GoalCategory;
  label: string;
  emoji: string;
  badges: CategoryBadge[];
  unlockedCount: number;
}

export const CATEGORY_META: Record<GoalCategory, { label: string; emoji: string }> = {
  fitness: { label: "Fitness", emoji: "🏋️" },
  learning: { label: "Learning", emoji: "📚" },
  reading: { label: "Reading", emoji: "📖" },
  creative: { label: "Creative", emoji: "🎨" },
  career: { label: "Career", emoji: "💼" },
  wellness: { label: "Wellness", emoji: "🧘" },
  general: { label: "General", emoji: "⭐" },
};

type BadgeSeed = { title: string; emoji: string; tagline: string };

const FITNESS_BADGES: BadgeSeed[] = [
  { title: "WARM-UP WARRIOR", emoji: "🐰", tagline: "You planted your first fitness goal." },
  { title: "FIRST REP", emoji: "💪", tagline: "The first step is the hardest — you took it." },
  { title: "MORNING MOVER", emoji: "🌅", tagline: "Early sessions are becoming a thing." },
  { title: "STEP COUNTER", emoji: "👟", tagline: "Mileage is adding up." },
  { title: "CARDIO BUNNY", emoji: "🏃", tagline: "Heart rate up, excuses down." },
  { title: "GYM REGULAR", emoji: "🔄", tagline: "Showing up is your superpower." },
  { title: "GYM BUNNY", emoji: "🐇", tagline: "Consistency is building muscle." },
  { title: "SWEAT EQUITY", emoji: "💦", tagline: "You earn every drop." },
  { title: "IRON PUMP", emoji: "🏋️‍♀️", tagline: "Strength sessions stacking." },
  { title: "ENDURANCE EAR", emoji: "🎧", tagline: "Long haul? No problem." },
  { title: "PR HUNTER", emoji: "🎯", tagline: "Personal records in sight." },
  { title: "BEAST MODE", emoji: "🦁", tagline: "Intensity unlocked." },
  { title: "MARATHON MIND", emoji: "🧠", tagline: "Mental toughness on display." },
  { title: "NO DAYS OFF", emoji: "📅", tagline: "Discipline is your default." },
  { title: "CHAMPION CHIN", emoji: "🥊", tagline: "You don't quit mid-round." },
  { title: "LEGEND IN TRAINING", emoji: "⭐", tagline: "The grind is real." },
  { title: "GAINZ GOBLIN", emoji: "👹", tagline: "Feeding the gains daily." },
  { title: "FIT FINISHER", emoji: "✅", tagline: "You closed out a fitness goal." },
  { title: "ELITE ATHLETE", emoji: "🥇", tagline: "Top-tier commitment." },
  { title: "FITNESS GOD", emoji: "🏆", tagline: "Legendary discipline unlocked." },
];

const READING_BADGES: BadgeSeed[] = [
  { title: "PAGE SPROUT", emoji: "🌱", tagline: "A new story begins." },
  { title: "FIRST CHAPTER", emoji: "📄", tagline: "Hooked from page one." },
  { title: "BOOKMARK BUDDY", emoji: "🔖", tagline: "Always picking up where you left off." },
  { title: "QUIET CORNER", emoji: "🪑", tagline: "Reading nook energy." },
  { title: "PLOT TWIST", emoji: "😮", tagline: "Can't stop turning pages." },
  { title: "STREAK READER", emoji: "🔥", tagline: "Daily pages are a habit." },
  { title: "BOOKWORM", emoji: "📚", tagline: "You can't put books down." },
  { title: "SHELF LOADER", emoji: "📖", tagline: "The stack keeps growing." },
  { title: "NIGHT OWL READER", emoji: "🌙", tagline: "Just one more chapter…" },
  { title: "SPEED FLIP", emoji: "⚡", tagline: "Pages flying by." },
  { title: "GENRE HOPPER", emoji: "🎭", tagline: "Exploring every shelf." },
  { title: "DEEP DIVE", emoji: "🤿", tagline: "Lost in the story." },
  { title: "LIBRARY VIP", emoji: "🏛️", tagline: "Regular at the stacks." },
  { title: "CHAPTER CHAMP", emoji: "👑", tagline: "Chapter after chapter." },
  { title: "TOME TACKLER", emoji: "📕", tagline: "Big books don't scare you." },
  { title: "STORY SAGE", emoji: "🦉", tagline: "Wisdom between the lines." },
  { title: "FINISHED IT", emoji: "✅", tagline: "You crossed the last page." },
  { title: "BIBLIOPHILE", emoji: "💎", tagline: "Books are your world." },
  { title: "PAGE MACHINE", emoji: "⚙️", tagline: "Unstoppable reading pace." },
  { title: "SUPER READER", emoji: "🦸", tagline: "You devour books for breakfast." },
];

const LEARNING_BADGES: BadgeSeed[] = [
  { title: "CURIOUS MIND", emoji: "🔍", tagline: "Learning journey started." },
  { title: "NOTE TAKER", emoji: "📝", tagline: "Ideas captured." },
  { title: "QUESTION ASKER", emoji: "❓", tagline: "Curiosity leads the way." },
  { title: "FOCUS BLOCK", emoji: "🧱", tagline: "Deep work sessions count." },
  { title: "SKILL SEED", emoji: "🌱", tagline: "New skills taking root." },
  { title: "STUDY STREAK", emoji: "🔥", tagline: "Daily learning locked in." },
  { title: "STUDY BUNNY", emoji: "🐰", tagline: "Knowledge is stacking up." },
  { title: "BRAIN BUILDER", emoji: "🧩", tagline: "Connecting the dots." },
  { title: "LECTURE LOVER", emoji: "🎓", tagline: "Always room to learn more." },
  { title: "PRACTICE PRO", emoji: "🔁", tagline: "Reps make perfect." },
  { title: "AHA MOMENT", emoji: "💡", tagline: "Breakthroughs happen." },
  { title: "DEEP LEARNER", emoji: "🤿", tagline: "Going beyond the surface." },
  { title: "KNOWLEDGE NINJA", emoji: "🥷", tagline: "Quietly leveling up." },
  { title: "MASTER CLASS", emoji: "📡", tagline: "Advanced territory." },
  { title: "SYNTHESIS STAR", emoji: "✨", tagline: "You connect ideas fast." },
  { title: "LEARNING LEGEND", emoji: "⭐", tagline: "Hours upon hours invested." },
  { title: "COURSE CRUSHER", emoji: "✅", tagline: "You finished what you started." },
  { title: "WISDOM SEEKER", emoji: "🔮", tagline: "Always hungry to know more." },
  { title: "BRAIN BOOSTED", emoji: "🚀", tagline: "Next-level knowledge." },
  { title: "KNOWLEDGE SAGE", emoji: "🎓", tagline: "Wisdom level: max." },
];

const CREATIVE_BADGES: BadgeSeed[] = [
  { title: "SPARK STARTER", emoji: "✨", tagline: "Creative seeds planted." },
  { title: "DOODLE DREAM", emoji: "✏️", tagline: "First marks on the page." },
  { title: "COLOR PLAY", emoji: "🎨", tagline: "Experimenting freely." },
  { title: "IDEA SKETCH", emoji: "💭", tagline: "Imagination unleashed." },
  { title: "FLOW STATE", emoji: "🌊", tagline: "In the zone." },
  { title: "CREATE STREAK", emoji: "🔥", tagline: "Making every day." },
  { title: "CREATIVE SOUL", emoji: "🖌️", tagline: "Your muse is awake." },
  { title: "CANVAS CALL", emoji: "🖼️", tagline: "Projects taking shape." },
  { title: "MIX & MATCH", emoji: "🎭", tagline: "Trying new mediums." },
  { title: "BUILD MODE", emoji: "🔧", tagline: "Crafting something real." },
  { title: "BOLD STROKE", emoji: "🖊️", tagline: "Confidence on the canvas." },
  { title: "STUDIO REGULAR", emoji: "🏠", tagline: "Your creative space awaits." },
  { title: "VISION BOARD", emoji: "📌", tagline: "Big ideas coming alive." },
  { title: "ARTISAN ARC", emoji: "📈", tagline: "Skill curve climbing." },
  { title: "MUSE MAGNET", emoji: "🧲", tagline: "Inspiration finds you." },
  { title: "CREATIVE FIRE", emoji: "🔥", tagline: "Unstoppable output." },
  { title: "PROJECT DONE", emoji: "✅", tagline: "You shipped the work." },
  { title: "GALLERY READY", emoji: "🏛️", tagline: "Portfolio-worthy stuff." },
  { title: "CREATIVE ICON", emoji: "💎", tagline: "Your style is unmistakable." },
  { title: "MASTER ARTISAN", emoji: "👑", tagline: "Artistry in full bloom." },
];

const CAREER_BADGES: BadgeSeed[] = [
  { title: "FIRST STEP", emoji: "👣", tagline: "Career growth begins." },
  { title: "INBOX ZERO", emoji: "📬", tagline: "Small wins matter." },
  { title: "NETWORK NODE", emoji: "🤝", tagline: "Building connections." },
  { title: "SKILL STACK", emoji: "📚", tagline: "Adding tools to the belt." },
  { title: "FOCUS HOUR", emoji: "⏰", tagline: "Protected deep work." },
  { title: "GRIND STREAK", emoji: "🔥", tagline: "Consistent professional effort." },
  { title: "CAREER CLIMBER", emoji: "📈", tagline: "Upward momentum." },
  { title: "DECK MASTER", emoji: "📊", tagline: "Presentations polished." },
  { title: "DEADLINE HERO", emoji: "⚡", tagline: "Delivered under pressure." },
  { title: "LEAD MODE", emoji: "🎯", tagline: "Taking ownership." },
  { title: "STRATEGY BRAIN", emoji: "🧠", tagline: "Thinking three moves ahead." },
  { title: "OFFICE MVP", emoji: "⭐", tagline: "Reliable every week." },
  { title: "PROMOTION PATH", emoji: "🛤️", tagline: "Next level loading." },
  { title: "EXEC ENERGY", emoji: "💼", tagline: "Big-picture focus." },
  { title: "IMPACT MAKER", emoji: "💥", tagline: "Work that matters." },
  { title: "CAREER PEAK", emoji: "🏔️", tagline: "Summit in sight." },
  { title: "GOAL CRUSHED", emoji: "✅", tagline: "Professional target hit." },
  { title: "INDUSTRY PRO", emoji: "🥇", tagline: "Respected and ready." },
  { title: "CORNER OFFICE", emoji: "🚪", tagline: "Top-tier trajectory." },
  { title: "CEO ENERGY", emoji: "👔", tagline: "Boardroom ready." },
];

const WELLNESS_BADGES: BadgeSeed[] = [
  { title: "ZEN SEED", emoji: "🌸", tagline: "Inner work starts here." },
  { title: "BREATH WORK", emoji: "🌬️", tagline: "One inhale at a time." },
  { title: "STRETCH START", emoji: "🧘", tagline: "Body and mind aligned." },
  { title: "HYDRATION HERO", emoji: "💧", tagline: "Small rituals count." },
  { title: "CALM CORNER", emoji: "🕯️", tagline: "Peace is a practice." },
  { title: "WELLNESS STREAK", emoji: "🔥", tagline: "Self-care on repeat." },
  { title: "WELLNESS WARRIOR", emoji: "🛡️", tagline: "Balance is becoming habit." },
  { title: "MINDFUL MOMENT", emoji: "🧠", tagline: "Present and grounded." },
  { title: "REST RESET", emoji: "😴", tagline: "Recovery is productive." },
  { title: "NATURE BREAK", emoji: "🌿", tagline: "Fresh air, fresh mind." },
  { title: "GRATITUDE LOG", emoji: "🙏", tagline: "Perspective shifted." },
  { title: "BALANCE BEAM", emoji: "⚖️", tagline: "Work-life harmony." },
  { title: "SERENITY SEEKER", emoji: "🕊️", tagline: "Calm under pressure." },
  { title: "HEALING HABIT", emoji: "💚", tagline: "Wellness woven in." },
  { title: "INNER LIGHT", emoji: "✨", tagline: "Radiating calm." },
  { title: "PEACE PRO", emoji: "☮️", tagline: "Master of the pause." },
  { title: "WELLNESS WIN", emoji: "✅", tagline: "You completed the journey." },
  { title: "HARMONY HERO", emoji: "🎵", tagline: "Life in sync." },
  { title: "BLISS BUILDER", emoji: "🌈", tagline: "Joy is the goal." },
  { title: "INNER PEACE PRO", emoji: "🧘‍♀️", tagline: "Calm, collected, complete." },
];

const GENERAL_BADGES: BadgeSeed[] = [
  { title: "GOAL GETTER", emoji: "🎯", tagline: "Systems over wishes." },
  { title: "FIRST LOG", emoji: "📋", tagline: "Progress tracked." },
  { title: "TINY WIN", emoji: "🌱", tagline: "Small steps compound." },
  { title: "HABIT HOOK", emoji: "🪝", tagline: "Routine taking hold." },
  { title: "STREAK START", emoji: "🔥", tagline: "Don't break the chain." },
  { title: "WEEK WARRIOR", emoji: "📅", tagline: "Seven days strong." },
  { title: "SYSTEM BUILDER", emoji: "⚙️", tagline: "Habits are taking shape." },
  { title: "MOMENTUM", emoji: "🚀", tagline: "Rolling forward." },
  { title: "CHECKPOINT", emoji: "🏁", tagline: "Quarter way there." },
  { title: "HALFWAY HERO", emoji: "⭐", tagline: "50% is real progress." },
  { title: "GRIND MODE", emoji: "💪", tagline: "Consistency wins." },
  { title: "NO EXCUSES", emoji: "🛑", tagline: "Showing up anyway." },
  { title: "COMPOUND KING", emoji: "📈", tagline: "Results stacking." },
  { title: "FINISH STRONG", emoji: "🏃", tagline: "Closing in on the target." },
  { title: "ALMOST THERE", emoji: "🎪", tagline: "The home stretch." },
  { title: "DEDICATION", emoji: "💎", tagline: "Commitment proven." },
  { title: "GOAL COMPLETE", emoji: "✅", tagline: "You did the thing." },
  { title: "HABIT MASTER", emoji: "🎖️", tagline: "Systems mastered." },
  { title: "UNSTOPPABLE", emoji: "🦸", tagline: "Nothing slows you down." },
  { title: "HABIT HERO", emoji: "🏆", tagline: "Atomic habits, giant results." },
];

const BADGE_SEEDS: Record<GoalCategory, BadgeSeed[]> = {
  fitness: FITNESS_BADGES,
  reading: READING_BADGES,
  learning: LEARNING_BADGES,
  creative: CREATIVE_BADGES,
  career: CAREER_BADGES,
  wellness: WELLNESS_BADGES,
  general: GENERAL_BADGES,
};

interface CategoryStats {
  goalCount: number;
  totalLogged: number;
  completedCount: number;
  maxStreak: number;
}

type TierTarget = {
  hours?: number;
  pages?: number;
  streak?: number;
  completed?: number;
  goals?: number;
  /** `all` = every listed criterion must be met (harder). */
  mode: "any" | "all";
};

function getTierTarget(category: GoalCategory, tier: number): TierTarget {
  if (tier === 1) return { goals: 1, mode: "all" };

  const reading = isReadingCategory(category);
  const streakTier = tier % 4 === 0;

  if (reading) {
    const pages = Math.round(20 * tier ** 1.55);
    const streak = Math.round(tier * 3.5);

    if (tier >= 20) return { pages: 2500, streak: 90, completed: 3, mode: "all" };
    if (tier >= 19) return { pages: 1800, streak: 60, completed: 2, mode: "all" };
    if (tier >= 18) return { pages: 1200, completed: 1, streak: 45, mode: "all" };
    if (streakTier) return { pages: Math.round(pages * 0.7), streak, mode: "all" };
    return { pages, mode: "any" };
  }

  const hours = Math.round(5 * tier ** 1.5);
  const streak = Math.round(tier * 3.5);

  if (tier >= 20) return { hours: 400, streak: 90, completed: 3, mode: "all" };
  if (tier >= 19) return { hours: 280, streak: 60, completed: 2, mode: "all" };
  if (tier >= 18) return { hours: 180, completed: 1, streak: 45, mode: "all" };
  if (streakTier) return { hours: Math.round(hours * 0.7), streak, mode: "all" };
  return { hours, mode: "any" };
}

function formatTierRequirement(category: GoalCategory, tier: number, target: TierTarget): string {
  if (target.goals) return `Create a ${CATEGORY_META[category].label.toLowerCase()} goal`;

  const parts: string[] = [];
  if (target.hours) parts.push(`${target.hours}+ hours logged`);
  if (target.pages) parts.push(`${target.pages}+ pages/chapters logged`);
  if (target.streak) parts.push(`${target.streak}-day streak`);
  if (target.completed) {
    parts.push(
      target.completed === 1
        ? "complete a goal in this category"
        : `complete ${target.completed} goals in this category`,
    );
  }

  if (tier > 1) parts.unshift(`Earn badge #${tier - 1} first`);

  if (target.mode === "all") return parts.join(", AND ");
  return parts.join(" OR ");
}

function requirementForTier(category: GoalCategory, tier: number): string {
  return formatTierRequirement(category, tier, getTierTarget(category, tier));
}

function criterionProgress(actual: number, target?: number): number {
  if (!target) return 100;
  return Math.min(100, (actual / target) * 100);
}

function tierProgress(stats: CategoryStats, category: GoalCategory, tier: BadgeTier): number {
  const target = getTierTarget(category, tier);
  const parts = [
    criterionProgress(stats.goalCount, target.goals),
    criterionProgress(stats.totalLogged, target.hours),
    criterionProgress(stats.totalLogged, target.pages),
    criterionProgress(stats.maxStreak, target.streak),
    criterionProgress(stats.completedCount, target.completed),
  ].filter((_, i) => {
    const keys = [target.goals, target.hours, target.pages, target.streak, target.completed];
    return keys[i] !== undefined;
  });

  if (parts.length === 0) return 0;
  return target.mode === "all" ? Math.min(...parts) : Math.max(...parts);
}

function tierUnlocked(stats: CategoryStats, category: GoalCategory, tier: BadgeTier): boolean {
  if (tierProgress(stats, category, tier) < 100) return false;
  if (tier === 1) return true;
  return tierUnlocked(stats, category, (tier - 1) as BadgeTier);
}

function buildCategoryBadgeDefs(category: GoalCategory): CategoryBadgeDef[] {
  return BADGE_SEEDS[category].slice(0, BADGES_PER_CATEGORY).map((seed, index) => {
    const tier = (index + 1) as BadgeTier;
    return {
      id: `${category}-${tier}`,
      category,
      tier,
      title: seed.title,
      emoji: seed.emoji,
      tagline: seed.tagline,
      requirement: requirementForTier(category, tier),
    };
  });
}

export const CATEGORY_BADGES: CategoryBadgeDef[] = (Object.keys(CATEGORY_META) as GoalCategory[]).flatMap(
  buildCategoryBadgeDefs,
);

function categoryStats(goals: GoalWithProgress[], category: GoalCategory): CategoryStats {
  const inCat = goals.filter((g) => g.category === category);
  return {
    goalCount: inCat.length,
    totalLogged: inCat.reduce((s, g) => s + g.totalLogged, 0),
    completedCount: inCat.filter(isGoalComplete).length,
    maxStreak: inCat.reduce((m, g) => Math.max(m, g.streak), 0),
  };
}

function badgeDisplayProgress(stats: CategoryStats, category: GoalCategory, tier: BadgeTier): number {
  if (tier > 1 && !tierUnlocked(stats, category, (tier - 1) as BadgeTier)) return 0;
  return tierProgress(stats, category, tier);
}

export function computeCategoryBadges(goals: GoalWithProgress[]): CategoryBadgeGroup[] {
  const categories = Object.keys(CATEGORY_META) as GoalCategory[];

  return categories.map((category) => {
    const stats = categoryStats(goals, category);
    const meta = CATEGORY_META[category];

    const badges: CategoryBadge[] = CATEGORY_BADGES.filter((b) => b.category === category).map((def) => ({
      ...def,
      unlocked: tierUnlocked(stats, category, def.tier),
      progress: badgeDisplayProgress(stats, category, def.tier),
    }));

    return {
      category,
      label: meta.label,
      emoji: meta.emoji,
      badges,
      unlockedCount: badges.filter((b) => b.unlocked).length,
    };
  });
}

export function totalUnlockedBadges(groups: CategoryBadgeGroup[]): number {
  return groups.reduce((s, g) => s + g.unlockedCount, 0);
}

export function totalBadgeCount(): number {
  return CATEGORY_BADGES.length;
}
