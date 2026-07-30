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

export type BadgeTier = 1 | 2 | 3;

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

export const CATEGORY_META: Record<
  GoalCategory,
  { label: string; emoji: string }
> = {
  fitness: { label: "Fitness", emoji: "🏋️" },
  learning: { label: "Learning", emoji: "📚" },
  reading: { label: "Reading", emoji: "📖" },
  creative: { label: "Creative", emoji: "🎨" },
  career: { label: "Career", emoji: "💼" },
  wellness: { label: "Wellness", emoji: "🧘" },
  general: { label: "General", emoji: "⭐" },
};

export const CATEGORY_BADGES: CategoryBadgeDef[] = [
  { id: "fitness-1", category: "fitness", tier: 1, title: "WARM-UP WARRIOR", emoji: "🐰", tagline: "You planted your first fitness goal.", requirement: "Create a fitness goal" },
  { id: "fitness-2", category: "fitness", tier: 2, title: "GYM BUNNY", emoji: "💪", tagline: "Consistency is building muscle.", requirement: "Log 5+ hours or hit a 7-day streak" },
  { id: "fitness-3", category: "fitness", tier: 3, title: "FITNESS GOD", emoji: "🏆", tagline: "Legendary discipline unlocked.", requirement: "Complete a fitness goal or log 20+ hours" },

  { id: "reading-1", category: "reading", tier: 1, title: "PAGE SPROUT", emoji: "🌱", tagline: "A new story begins.", requirement: "Create a reading goal" },
  { id: "reading-2", category: "reading", tier: 2, title: "BOOKWORM", emoji: "📚", tagline: "You can't put books down.", requirement: "Log 50+ pages/chapters or a 7-day streak" },
  { id: "reading-3", category: "reading", tier: 3, title: "SUPER READER", emoji: "🦸", tagline: "You devour books for breakfast.", requirement: "Finish a book goal or log 200+ pages/chapters" },

  { id: "learning-1", category: "learning", tier: 1, title: "CURIOUS MIND", emoji: "🔍", tagline: "Learning journey started.", requirement: "Create a learning goal" },
  { id: "learning-2", category: "learning", tier: 2, title: "STUDY BUNNY", emoji: "📝", tagline: "Knowledge is stacking up.", requirement: "Log 5+ hours or hit a 7-day streak" },
  { id: "learning-3", category: "learning", tier: 3, title: "KNOWLEDGE SAGE", emoji: "🎓", tagline: "Wisdom level: max.", requirement: "Complete a learning goal or log 20+ hours" },

  { id: "creative-1", category: "creative", tier: 1, title: "SPARK STARTER", emoji: "✨", tagline: "Creative seeds planted.", requirement: "Create a creative goal" },
  { id: "creative-2", category: "creative", tier: 2, title: "CREATIVE SOUL", emoji: "🖌️", tagline: "Your muse is awake.", requirement: "Log 5+ hours or hit a 7-day streak" },
  { id: "creative-3", category: "creative", tier: 3, title: "MASTER ARTISAN", emoji: "👑", tagline: "Artistry in full bloom.", requirement: "Complete a creative goal or log 20+ hours" },

  { id: "career-1", category: "career", tier: 1, title: "FIRST STEP", emoji: "👣", tagline: "Career growth begins.", requirement: "Create a career goal" },
  { id: "career-2", category: "career", tier: 2, title: "CAREER CLIMBER", emoji: "📈", tagline: "Upward momentum.", requirement: "Log 5+ hours or hit a 7-day streak" },
  { id: "career-3", category: "career", tier: 3, title: "CEO ENERGY", emoji: "💼", tagline: "Boardroom ready.", requirement: "Complete a career goal or log 20+ hours" },

  { id: "wellness-1", category: "wellness", tier: 1, title: "ZEN SEED", emoji: "🌸", tagline: "Inner work starts here.", requirement: "Create a wellness goal" },
  { id: "wellness-2", category: "wellness", tier: 2, title: "WELLNESS WARRIOR", emoji: "🧘", tagline: "Balance is becoming habit.", requirement: "Log 5+ hours or hit a 7-day streak" },
  { id: "wellness-3", category: "wellness", tier: 3, title: "INNER PEACE PRO", emoji: "☮️", tagline: "Calm, collected, complete.", requirement: "Complete a wellness goal or log 20+ hours" },

  { id: "general-1", category: "general", tier: 1, title: "GOAL GETTER", emoji: "🎯", tagline: "Systems over wishes.", requirement: "Create any general goal" },
  { id: "general-2", category: "general", tier: 2, title: "SYSTEM BUILDER", emoji: "⚙️", tagline: "Habits are taking shape.", requirement: "Log 5+ hours or hit a 7-day streak" },
  { id: "general-3", category: "general", tier: 3, title: "HABIT HERO", emoji: "🦸", tagline: "Atomic habits, giant results.", requirement: "Complete a general goal or log 20+ hours" },
];

interface CategoryStats {
  goalCount: number;
  totalLogged: number;
  completedCount: number;
  maxStreak: number;
}

function categoryStats(goals: GoalWithProgress[], category: GoalCategory): CategoryStats {
  const inCat = goals.filter((g) => g.category === category);
  return {
    goalCount: inCat.length,
    totalLogged: inCat.reduce((s, g) => s + g.totalLogged, 0),
    completedCount: inCat.filter(isGoalComplete).length,
    maxStreak: inCat.reduce((m, g) => Math.max(m, g.streak), 0),
  };
}

function tierProgress(stats: CategoryStats, category: GoalCategory, tier: BadgeTier): number {
  const reading = isReadingCategory(category);
  if (tier === 1) return stats.goalCount > 0 ? 100 : 0;
  if (tier === 2) {
    const loggedTarget = reading ? 50 : 5;
    const loggedPct = Math.min(100, (stats.totalLogged / loggedTarget) * 100);
    const streakPct = Math.min(100, (stats.maxStreak / 7) * 100);
    return Math.max(loggedPct, streakPct);
  }
  const loggedTarget = reading ? 200 : 20;
  const loggedPct = Math.min(100, (stats.totalLogged / loggedTarget) * 100);
  const completePct = stats.completedCount > 0 ? 100 : 0;
  const streakPct = Math.min(100, (stats.maxStreak / 14) * 100);
  return Math.max(loggedPct, completePct, streakPct);
}

function tierUnlocked(stats: CategoryStats, category: GoalCategory, tier: BadgeTier): boolean {
  return tierProgress(stats, category, tier) >= 100;
}

export function computeCategoryBadges(goals: GoalWithProgress[]): CategoryBadgeGroup[] {
  const categories = Object.keys(CATEGORY_META) as GoalCategory[];

  return categories.map((category) => {
    const stats = categoryStats(goals, category);
    const meta = CATEGORY_META[category];

    const badges: CategoryBadge[] = CATEGORY_BADGES.filter((b) => b.category === category).map((def) => ({
      ...def,
      unlocked: tierUnlocked(stats, category, def.tier),
      progress: tierProgress(stats, category, def.tier),
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
