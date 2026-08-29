import prisma from '../lib/prisma';

export type BadgeTierCode = 'UNRANKED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface BadgeTierConfig {
  code: BadgeTierCode;
  min: number;
  max: number | null;
  name: string;
  marathiName: string;
  icon: string;
  color: string;
  gradient: string;
  borderColor: string;
  description: string;
}

export const BADGE_TIERS: BadgeTierConfig[] = [
  {
    code: 'UNRANKED',
    min: 0,
    max: 0,
    name: 'New Member',
    marathiName: 'नवीन सदस्य',
    icon: '🌱',
    color: '#64748b',
    gradient: 'from-slate-600 to-slate-700',
    borderColor: '#94a3b8',
    description: 'Link your first family member to unlock Bronze rank',
  },
  {
    code: 'BRONZE',
    min: 1,
    max: 5,
    name: 'Bronze Connector',
    marathiName: 'कांस्य जोडणी',
    icon: '🥉',
    color: '#cd7f32',
    gradient: 'from-amber-700 via-amber-600 to-amber-800',
    borderColor: '#d97706',
    description: 'Connected 1-5 verified members across family and friends',
  },
  {
    code: 'SILVER',
    min: 6,
    max: 15,
    name: 'Silver Pillar',
    marathiName: 'रौप्य आधारस्तंभ',
    icon: '🥈',
    color: '#94a3b8',
    gradient: 'from-slate-400 via-slate-200 to-slate-500',
    borderColor: '#cbd5e1',
    description: 'Growing family branch with 6-15 verified connections',
  },
  {
    code: 'GOLD',
    min: 16,
    max: 35,
    name: 'Gold Guardian',
    marathiName: 'सुवर्ण संरक्षक',
    icon: '🥇',
    color: '#f59e0b',
    gradient: 'from-amber-500 via-yellow-400 to-amber-600',
    borderColor: '#fbbf24',
    description: 'Key community connector with 16-35 verified connections',
  },
  {
    code: 'PLATINUM',
    min: 36,
    max: 75,
    name: 'Platinum Patriarch',
    marathiName: 'प्लॅटिनम मार्गदर्शक',
    icon: '💠',
    color: '#06b6d4',
    gradient: 'from-cyan-500 via-teal-300 to-blue-600',
    borderColor: '#38bdf8',
    description: 'Multi-branch heritage leader with 36-75 verified connections',
  },
  {
    code: 'DIAMOND',
    min: 76,
    max: null,
    name: 'Diamond Legend',
    marathiName: 'हिरा वारसदार',
    icon: '💎',
    color: '#8b5cf6',
    gradient: 'from-violet-600 via-fuchsia-400 to-indigo-600',
    borderColor: '#c084fc',
    description: 'Supreme community architect with 76+ verified connections',
  },
];

export interface UserBadgeInfo {
  tier: BadgeTierCode;
  name: string;
  marathiName: string;
  icon: string;
  color: string;
  gradient: string;
  borderColor: string;
  description: string;
  approvedCount: number;
  familyCount: number;
  friendCount: number;
  nextTier: BadgeTierConfig | null;
  progressPercent: number;
  remainingForNext: number;
  tiers: {
    code: BadgeTierCode;
    name: string;
    min: number;
    max: number | null;
    icon: string;
    color: string;
    isUnlocked: boolean;
    isCurrent: boolean;
  }[];
}

/**
 * Compute user badge metadata from raw approved linking counts
 */
export function calculateUserBadge(
  approvedCount: number,
  familyCount: number = 0,
  friendCount: number = 0
): UserBadgeInfo {
  // Find matching tier
  let currentTier: BadgeTierConfig = BADGE_TIERS[0]; // UNRANKED by default

  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const tier = BADGE_TIERS[i];
    if (approvedCount >= tier.min) {
      currentTier = tier;
      break;
    }
  }

  // Find next tier
  const currentIndex = BADGE_TIERS.findIndex(t => t.code === currentTier.code);
  const nextTier: BadgeTierConfig | null =
    currentIndex < BADGE_TIERS.length - 1 ? BADGE_TIERS[currentIndex + 1] : null;

  let progressPercent = 100;
  let remainingForNext = 0;

  if (nextTier) {
    const range = nextTier.min - currentTier.min;
    const currentProgress = approvedCount - currentTier.min;
    progressPercent = range > 0 ? Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100))) : 100;
    remainingForNext = Math.max(0, nextTier.min - approvedCount);
  }

  const tiersLadder = BADGE_TIERS.map(t => ({
    code: t.code,
    name: t.name,
    min: t.min,
    max: t.max,
    icon: t.icon,
    color: t.color,
    isUnlocked: approvedCount >= t.min,
    isCurrent: t.code === currentTier.code,
  }));

  return {
    tier: currentTier.code,
    name: currentTier.name,
    marathiName: currentTier.marathiName,
    icon: currentTier.icon,
    color: currentTier.color,
    gradient: currentTier.gradient,
    borderColor: currentTier.borderColor,
    description: currentTier.description,
    approvedCount,
    familyCount,
    friendCount,
    nextTier,
    progressPercent,
    remainingForNext,
    tiers: tiersLadder,
  };
}

/**
 * Query database for confirmed family & friend counts and return comprehensive badge object
 */
export async function getUserBadgeData(userId: string): Promise<UserBadgeInfo> {
  // Count confirmed family relations where user is involved
  const familyCount = await prisma.relation.count({
    where: {
      category: 'FAMILY',
      status: 'CONFIRMED',
      deletedAt: null,
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
        { createdById: userId },
      ],
    },
  });

  // Count confirmed friend relations where user is involved
  const friendCount = await prisma.relation.count({
    where: {
      category: 'FRIEND',
      status: 'CONFIRMED',
      deletedAt: null,
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
        { createdById: userId },
      ],
    },
  });

  const totalApproved = familyCount + friendCount;

  return calculateUserBadge(totalApproved, familyCount, friendCount);
}
