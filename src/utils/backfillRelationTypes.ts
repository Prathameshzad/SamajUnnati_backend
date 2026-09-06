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
  CHULAT_VAHINI: 'ROOT', CHULAT_DAJI: 'ROOT',
  CHULAT_AATYA_BHAU: 'ROOT', CHULAT_AATYA_BAHIN: 'ROOT',
  ATYE_BHAU: 'ROOT', ATYE_BAHIN: 'ROOT',

  // ── Maternal blood relatives (ROOT side — own family!) ───────────────────
  NANA: 'ROOT', NANI: 'ROOT',
  MAMA: 'ROOT', MAMI: 'ROOT',
  MAVSHI: 'ROOT', MAVSA: 'ROOT',
  MAMI_BHAU: 'ROOT', MAMI_BAHIN: 'ROOT',
  MAMI_VAHINI: 'ROOT', MAMI_DAJI: 'ROOT',
  MAV_BHAU: 'ROOT', MAV_BAHIN: 'ROOT',
  MAV_VAHINI: 'ROOT', MAV_DAJI: 'ROOT',

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
  MEVHANA: 'SPOUSE', MEVHANI: 'SPOUSE', SADU: 'SPOUSE',
  DIR_CHOTE: 'SPOUSE', DIR_MOTHE: 'SPOUSE',
  NANAND: 'SPOUSE', NANANDOI: 'SPOUSE',
  CHULTA_DIR: 'SPOUSE', CHULTA_NANAND: 'SPOUSE',

  // ── Partner's children / son-in-law & daughter-in-law (SPOUSE side) ──────
  SUN: 'ROOT', JAVAI: 'SPOUSE',
  SUN_SASU: 'SPOUSE', JAVAI_SASRA: 'SPOUSE',
  NATASUN: 'SPOUSE', NAT_JAVAI: 'SPOUSE',
  PANTISUN: 'SPOUSE', PANTU_JAVAI: 'SPOUSE',

  // ── Grandchildren-in-law chain ────────────────────────────────────────────
  BHACHA: 'ROOT', BHACHI: 'ROOT',   // children of bhau/bahin — ROOT side
  BHACHI_SUN: 'SPOUSE', JAVAIBHACHA: 'SPOUSE', // spouses of bhau/bahin's children

  // ── Extended paternal & maternal ancestors ──────────────────────────────
  NANA_PANJOBA: 'ROOT', NANI_PANJI: 'ROOT', NANA_PANJI: 'ROOT',
  AATYA_AAJI: 'ROOT', FUA_AJOBA: 'ROOT', FAU_AJOBA: 'ROOT', CHULAT_AJOBA: 'ROOT', CHULAT_AAJI: 'ROOT',
  MAMI_AJOBA: 'ROOT', MAME_AJOBA: 'ROOT', MAME_AAJOBA: 'ROOT', MAME_AAJI: 'ROOT', MAVAS_AAJI: 'ROOT', MAV_AAJI: 'ROOT', MAV_AAJOBA: 'ROOT',
  CHULAT_NANA: 'ROOT', AATYA_NANI: 'ROOT',
  MAMI_NANA: 'ROOT', MAME_NANA: 'ROOT', MAVAS_NANI: 'ROOT',
  MAMI_NANI: 'ROOT', MAME_NANI: 'ROOT', MAVSA_NANA: 'ROOT',
  CHULAT_NANI: 'ROOT', CHULAT_MAMA: 'ROOT', CHULAT_MAVSHI: 'ROOT', FUA_NANA: 'ROOT', FAU_NANA: 'ROOT',
  CHULAT_MAMI: 'ROOT', CHULAT_MAVSHA: 'ROOT',
  CHULAT_PANJOBA: 'ROOT', CHULAT_PANJI: 'ROOT', AATYA_PANJI: 'ROOT', FUA_PANJOBA: 'ROOT',
  CHULAT_AATYA_AAJOBA: 'ROOT', CHULAT_AATYA_AAJI: 'ROOT',
  KHAPAR_PANJOBA: 'ROOT', KHAPAR_PANJI: 'ROOT',
  KHAPAR_NANA: 'ROOT', KHAPAR_NANI: 'ROOT',
  MAME_PANJOBA: 'ROOT', MAMI_PANJI: 'ROOT', MAVSHI_PANJI: 'ROOT', MAVAS_PANJI: 'ROOT', MAVSA_PANJOBA: 'ROOT',
  AATYA_KHAPAR_PANJI: 'ROOT', CHULAT_KHAPAR_PANJOBA: 'ROOT',
  MAME_KHAPAR_PANJOBA: 'ROOT', MAVAS_KHAPAR_PANJI: 'ROOT',

  // ── Extended in-laws & siblings' peers ──────────────────────────────────
  BHAUJAI: 'SPOUSE', CHULAT_MEVHANA: 'SPOUSE', CHULAT_MEVHANI: 'SPOUSE',
  MAMI_SASRA: 'SPOUSE', CHULAT_NANAND: 'SPOUSE', CHULAT_BHAUJAI: 'SPOUSE',
  SUNRI: 'SPOUSE', SUNRI_CHA_BHAU: 'SPOUSE', SUNRI_CHI_BAHIN: 'SPOUSE',
  SADU_CHA_BHAU: 'SPOUSE', SADU_CHI_BAHIN: 'SPOUSE',
  NANANDOI_CHA_BHAU: 'SPOUSE', NANANDOI_CHI_BAHIN: 'SPOUSE',
  VYAHI: 'SPOUSE', VIHIN: 'SPOUSE',
  SUN_CHA_BHAU: 'ROOT', SUN_CHI_BAHIN: 'ROOT',
  JAVAI_CHA_BHAU: 'SPOUSE', JAVAI_CHI_BAHIN: 'SPOUSE',
  CHULAT_DIR: 'SPOUSE',
  MAVSA_CHA_BHAU: 'ROOT', MAVSA_CHI_BAHIN: 'ROOT',
  FUA_CHA_BHAU: 'ROOT', FUA_CHI_BAHIN: 'ROOT',
  MAMI_CHA_BHAU: 'ROOT', MAMI_CHI_BAHIN: 'ROOT',
  DAJI_CHA_BHAU: 'ROOT', DAJI_CHI_BAHIN: 'ROOT',
  KAKI_CHA_BHAU: 'ROOT', KAKI_CHI_BAHIN: 'ROOT',
  CHULAT_PUTANYA: 'ROOT', CHULAT_PUTANI: 'ROOT', CHULAT_SUN: 'ROOT',
  CHULAT_BHACHA: 'ROOT', CHULAT_BHACHI: 'ROOT',

  // ── Generic Relative catch-all ───────────────────────────────────────────
  NATEVAIK: 'ROOT',
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
