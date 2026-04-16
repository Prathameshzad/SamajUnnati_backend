/**
 * backfillRelationTypes.ts
 *
 * One-time script: populates `treeLevel` and `treeSide` for every RelationType
 * record in the database using the canonical metadata maps.
 *
 * Run with:
 *   npx ts-node -e "require('./src/utils/backfillRelationTypes').backfill().then(() => process.exit(0))"
 * OR during backend startup (idempotent — skips already-set records):
 *   import { backfill } from './utils/backfillRelationTypes';  backfill();
 */

import prisma from '../lib/prisma';
import { RELATION_LEVEL_MAP } from './relationMetadata';

/**
 * Canonical side for each relation code.
 *
 * Layout perspective rules:
 *   MALE root   → ROOT side = LEFT,   SPOUSE side = RIGHT
 *   FEMALE root → ROOT side = RIGHT,  SPOUSE side = LEFT
 *
 * ROOT  = the root user's own blood family (Vadil, Aai, Bhau, Mama, etc.)
 * SPOUSE = the partner + their family  (Bayko/Navra, Sasar, Sasu, Nanand, etc.)
 */
const RELATION_TREE_SIDE: Record<string, 'ROOT' | 'SPOUSE'> = {
  // ── Partner (always SPOUSE side) ─────────────────────────────────────────
  NAVRA: 'SPOUSE',
  BAYKO: 'SPOUSE',

  // ── Root's direct parents (ROOT side) ────────────────────────────────────
  VADIL: 'ROOT', SAVATR_VADIL: 'ROOT',
  AAI:   'ROOT', SAVATR_AAI:   'ROOT',

  // ── Paternal blood relatives (ROOT side) ─────────────────────────────────
  AJOBA: 'ROOT', AAJI: 'ROOT',
  PANJOBA: 'ROOT', PANAAJI: 'ROOT',
  KAKA: 'ROOT', KAKI: 'ROOT',
  AATYA: 'ROOT', FUA: 'ROOT',
  CHULTA: 'ROOT', CHULTI: 'ROOT',
  BHAU: 'ROOT', BAHIN: 'ROOT',
  VAHINI: 'ROOT', DAJI: 'ROOT',
  SAVATR_BHAU: 'ROOT', SAVATR_BAHIN: 'ROOT',
  CHULAT_BHAU: 'ROOT', CHULAT_BAHIN: 'ROOT',
  ATYE_BHAU: 'ROOT', ATYE_BAHIN: 'ROOT',

  // ── Maternal blood relatives (ROOT side — own family!) ───────────────────
  NANA: 'ROOT', NANI: 'ROOT',
  MAMA: 'ROOT', MAMI: 'ROOT',
  MAVSHI: 'ROOT', MAVSA: 'ROOT',
  MAMBHAU: 'ROOT', MAMBAHIN: 'ROOT',
  MAV_BHAU: 'ROOT', MAV_BAHIN: 'ROOT',

  // ── Root's children & grandchildren (ROOT side) ──────────────────────────
  MULGA: 'ROOT', MULGI: 'ROOT',
  SAVATR_MULGA: 'ROOT', SAVATR_MULGI: 'ROOT',
  PUTANYA: 'ROOT', PUTANI: 'ROOT',
  NATU: 'ROOT', NAAT: 'ROOT',
  PANTU: 'ROOT', PANTI: 'ROOT',
  PP_NATU: 'ROOT', PP_NAAT: 'ROOT',
  PPP_NATU: 'ROOT', PPP_NAAT: 'ROOT',

  // ── Partner's parents & grandparents (SPOUSE side) ───────────────────────
  SASRA: 'SPOUSE', SASU: 'SPOUSE',
  AJI_SASRA: 'SPOUSE', AJI_SASU: 'SPOUSE',
  AJOBA_SASRA: 'SPOUSE', AJOBA_SASU: 'SPOUSE',
  MAMA_SASRA: 'SPOUSE', MAMI_SASU: 'SPOUSE',
  CHULAT_SASRA: 'SPOUSE', ATYA_SASU: 'SPOUSE', MAVAS_SASU: 'SPOUSE',
  PANAJI_SASU: 'SPOUSE', PANJOBA_SASRA: 'SPOUSE',
  VAHINI_SASU: 'SPOUSE', DAJI_SASRA: 'SPOUSE',

  // ── Partner's siblings / in-laws (SPOUSE side) ───────────────────────────
  MEVHANA: 'SPOUSE', MEVHANI: 'SPOUSE',
  DIR_CHOTE: 'SPOUSE', DIR_MOTHE: 'SPOUSE',
  NANAND: 'SPOUSE', NANANDOI: 'SPOUSE',
  CHULTA_DIR: 'SPOUSE', CHULTA_NANAND: 'SPOUSE',

  // ── Partner's children / son-in-law & daughter-in-law (SPOUSE side) ──────
  SUN: 'SPOUSE', JAVAI: 'SPOUSE',
  SUN_SASU: 'SPOUSE', JAVAI_SASRA: 'SPOUSE',
  NATASUN: 'SPOUSE', NAT_JAVAI: 'SPOUSE',
  PANTISUN: 'SPOUSE', PANTU_JAVAI: 'SPOUSE',

  // ── Grandchildren-in-law chain ────────────────────────────────────────────
  BHACHA: 'ROOT', BHACHI: 'ROOT',   // children of bhau/bahin — ROOT side

  // ── Friends (treated as ROOT side for layout neutrality) ─────────────────
  MITRA: 'ROOT', MAITRIN: 'ROOT',
};

export async function backfill(): Promise<void> {
  console.log('🔄 Backfilling RelationType.treeLevel and RelationType.treeSide...');

  const allTypes = await prisma.relationType.findMany();
  let updated = 0;
  let skipped = 0;

  for (const rt of allTypes) {
    const level = RELATION_LEVEL_MAP[rt.code] ?? null;
    const side  = RELATION_TREE_SIDE[rt.code] ?? null;

    // Skip if both are already correct (idempotent)
    if (rt.treeLevel === level && (rt as any).treeSide === side) {
      skipped++;
      continue;
    }

    await prisma.relationType.update({
      where: { code: rt.code },
      data: { treeLevel: level, treeSide: side } as any,
    });
    updated++;
    console.log(`  ✅ ${rt.code} → level=${level}, side=${side}`);
  }

  console.log(`✔ Done. Updated: ${updated}, already correct: ${skipped}`);
}

// Allow direct invocation
if (require.main === module) {
  backfill()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
