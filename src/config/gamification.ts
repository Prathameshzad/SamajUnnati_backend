// src/config/gamification.ts
/**
 * Single source of truth for scoring and badge rules.
 *
 * These values previously existed in four places that could drift apart:
 *
 *  1. `scoreService.SCORE_POINTS` — the authoritative award amounts.
 *  2. `relationController.deleteRelation` — re-derived them by hand:
 *         let pointsToDeduct = isTargetAlive ? 5 : 2;
 *         if (relation.status === 'CONFIRMED') pointsToDeduct += 20;
 *     so changing SCORE_POINTS would silently desynchronise deletion from award.
 *  3. `web/components/ScoreWidget.tsx` — "+2 / +5 / +20" as display strings.
 *  4. `mobile/components/ScoreWidget.tsx` — the same strings again.
 *
 * Badge tier presentation had the same problem, and worse: the backend sends
 * `color`/`gradient`/`borderColor`, but both clients ignored them and switched on
 * the tier code with their own palettes — three different colour sets for the same
 * six tiers.
 *
 * The numbers and colours below are unchanged. They are just defined once and
 * served to the clients via `GET /api/config/gamification`.
 */

export type ScoreReason =
  | 'ADD_ALIVE'
  | 'ADD_DECEASED'
  | 'RELATION_APPROVED'
  | 'REMOVE_ALIVE'
  | 'REMOVE_DECEASED'
  | 'REMOVE_RELATION';

/** Points awarded per reason. Unchanged from the original SCORE_POINTS map. */
export const SCORE_POINTS: Record<ScoreReason, number> = {
  ADD_ALIVE: 5,
  ADD_DECEASED: 2,
  RELATION_APPROVED: 20,
  REMOVE_ALIVE: -5,
  REMOVE_DECEASED: -2,
  REMOVE_RELATION: -5,
};

/** Human-readable labels, previously duplicated in both ScoreWidget components. */
export const SCORE_REASON_LABELS: Record<ScoreReason, string> = {
  ADD_DECEASED: 'Added Ancestor',
  ADD_ALIVE: 'Added Family Member',
  RELATION_APPROVED: 'Relation Verified',
  REMOVE_DECEASED: 'Removed Ancestor',
  REMOVE_ALIVE: 'Removed Family Member',
  REMOVE_RELATION: 'Removed Connection',
};

/** Cumulative XP required to reach each level. Unchanged. */
export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 2000, 3000, 5000] as const;

export function calculateLevel(total: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

/**
 * Points reversed when a relation is deleted.
 *
 * This encodes exactly what `deleteRelation` did inline, but derives the numbers
 * from SCORE_POINTS so the two can no longer disagree.
 */
export function deletionPenalty(
  isTargetAlive: boolean,
  wasConfirmed: boolean
): { points: number; reason: Extract<ScoreReason, 'REMOVE_ALIVE' | 'REMOVE_DECEASED'> } {
  const reason = isTargetAlive ? 'REMOVE_ALIVE' : 'REMOVE_DECEASED';
  // Original: `isTargetAlive ? 5 : 2`, i.e. the magnitude of the matching add.
  let points = Math.abs(SCORE_POINTS[isTargetAlive ? 'ADD_ALIVE' : 'ADD_DECEASED']);
  if (wasConfirmed) {
    // Original: `pointsToDeduct += 20` — reverse the approval bonus too.
    points += Math.abs(SCORE_POINTS.RELATION_APPROVED);
  }
  return { points, reason };
}

/* ── Badge tiers ─────────────────────────────────────────────────────────── */

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

export const BADGE_TIERS: readonly BadgeTierConfig[] = [
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
] as const;

/**
 * Payload for `GET /api/config/gamification`, so both clients render rules and
 * tier colours from the server rather than from their own hardcoded copies.
 */
export const gamificationConfig = () => ({
  scorePoints: SCORE_POINTS,
  scoreReasonLabels: SCORE_REASON_LABELS,
  levelThresholds: LEVEL_THRESHOLDS,
  badgeTiers: BADGE_TIERS,
  /** Pre-formatted "how to earn" rows, previously hardcoded in both ScoreWidgets. */
  earningRules: [
    { reason: 'ADD_DECEASED' as ScoreReason, points: SCORE_POINTS.ADD_DECEASED, label: 'Ancestor' },
    { reason: 'ADD_ALIVE' as ScoreReason, points: SCORE_POINTS.ADD_ALIVE, label: 'Living Member' },
    { reason: 'RELATION_APPROVED' as ScoreReason, points: SCORE_POINTS.RELATION_APPROVED, label: 'Approved' },
  ],
});
