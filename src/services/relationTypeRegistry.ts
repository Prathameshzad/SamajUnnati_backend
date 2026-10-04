// src/services/relationTypeRegistry.ts
/**
 * In-process registry of RelationType rows and their translations.
 *
 * The problem it solves:
 *
 *   async function resolveRelationForViewer(rel, viewerUserId, lang) {
 *     if (rel.toUserId === viewerUserId) {
 *       const recType = await prisma.relationType.findUnique({   // <-- per relation
 *         where: { code: reciprocalCode },
 *         include: { translations: true },
 *       });
 *       ...
 *
 * That runs inside `Promise.all(raw.map(...))` in `listRelations`, `getTree`,
 * `getRequests` and `getAcceptedRequests`. A user with 400 relations produced up
 * to 400 extra queries for a single GET, all of them fetching rows from a table
 * that changes maybe once a month. It is the dominant cost on those endpoints and
 * the main reason they get slow as a user's tree grows.
 *
 * `getFullTree` had already worked around this by pre-loading every type into a
 * Map; this generalises that fix so all callers share one cached copy.
 *
 * RelationType is small, bounded reference data (hundreds of rows), so caching it
 * in process memory is appropriate. A short TTL means edits still propagate
 * without a restart.
 */
import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('relation-types');

/** Reference data changes rarely; 5 minutes bounds staleness cheaply. */
const TTL_MS = 5 * 60 * 1000;

export interface RelationTranslationRecord {
  languageCode: string;
  label: string;
  community: string | null;
}

export interface RelationTypeRecord {
  code: string;
  category: 'FAMILY' | 'FRIEND' | 'MATRIMONY';
  targetGender: 'MALE' | 'FEMALE' | null;
  treeLevel: number | null;
  reciprocalCode: string | null;
  treeSide: string | null;
  /**
   * Kept in the exact order Prisma returned it. `resolveLabel` falls back to
   * `translations[0]` when the requested language is missing, so reordering here
   * would silently change which label users see.
   */
  translations: RelationTranslationRecord[];
}

export class RelationTypeRegistry {
  private readonly byCode: Map<string, RelationTypeRecord>;

  constructor(records: RelationTypeRecord[]) {
    this.byCode = new Map(records.map((record) => [record.code, record]));
  }

  get(code: string | null | undefined): RelationTypeRecord | undefined {
    return code ? this.byCode.get(code) : undefined;
  }

  all(): RelationTypeRecord[] {
    return Array.from(this.byCode.values());
  }

  get size(): number {
    return this.byCode.size;
  }

  /**
   * Byte-for-byte the same resolution order as the original `resolveLabel`:
   * exact language match, else the first translation, else the raw code.
   */
  label(code: string | null | undefined, lang: string): string {
    if (!code) return 'UNKNOWN';
    const record = this.byCode.get(code);
    if (!record || record.translations.length === 0) return code;
    const match =
      record.translations.find((translation) => translation.languageCode === lang) ??
      record.translations[0];
    return match ? match.label : code;
  }

  /**
   * Reciprocal code, falling back to the original when none is configured.
   * Uses `||` rather than `??` to match the original
   * `rel.relationType?.reciprocalCode || rel.relationTypeCode`, so an empty
   * string still falls back exactly as it did before.
   */
  reciprocalOf(code: string): string {
    return this.byCode.get(code)?.reciprocalCode || code;
  }
}

let cached: RelationTypeRegistry | null = null;
let cachedAt = 0;
/** De-duplicates concurrent loads during a cold start. */
let inFlight: Promise<RelationTypeRegistry> | null = null;

async function load(): Promise<RelationTypeRegistry> {
  const rows = await prisma.relationType.findMany({
    select: {
      code: true,
      category: true,
      targetGender: true,
      treeLevel: true,
      reciprocalCode: true,
      treeSide: true,
      translations: {
        select: { languageCode: true, label: true, community: true },
      },
    },
  });

  const registry = new RelationTypeRegistry(rows as unknown as RelationTypeRecord[]);
  cached = registry;
  cachedAt = Date.now();
  log.debug({ types: registry.size }, 'relation type registry loaded');
  return registry;
}

/** Returns the cached registry, refreshing it when the TTL has elapsed. */
export async function getRelationTypeRegistry(): Promise<RelationTypeRegistry> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;

  if (inFlight) return inFlight;

  inFlight = load()
    .catch((err) => {
      log.error({ err }, 'failed to load relation types');
      // Serving slightly stale reference data beats failing the request.
      if (cached) return cached;
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Forces a reload; call after mutating RelationType or RelationTranslation. */
export function invalidateRelationTypeRegistry(): void {
  cached = null;
  cachedAt = 0;
}

const ESSENTIAL_TYPES = [
  {
    code: 'MAME_SASRA',
    category: 'FAMILY' as const,
    targetGender: 'MALE' as const,
    treeLevel: 1,
    treeSide: 'SPOUSE',
    reciprocalCode: 'JAVAI',
    mr: 'मामे सासरा',
    en: 'Uncle-in-law (Maternal)',
  },
  {
    code: 'CHULAT_SASU',
    category: 'FAMILY' as const,
    targetGender: 'FEMALE' as const,
    treeLevel: 1,
    treeSide: 'SPOUSE',
    reciprocalCode: 'PUTAN_JAVAI',
    mr: 'चुलत सासू',
    en: 'Paternal Aunt-in-law',
  },
  {
    code: 'CHULAT_MEVHANA',
    category: 'FAMILY' as const,
    targetGender: 'MALE' as const,
    treeLevel: 0,
    treeSide: 'SPOUSE',
    reciprocalCode: 'CHULAT_MEVHANA',
    mr: 'चुलत मेव्हणा',
    en: 'Cousin Brother-in-law',
  },
  {
    code: 'CHULAT_MEVHANI',
    category: 'FAMILY' as const,
    targetGender: 'FEMALE' as const,
    treeLevel: 0,
    treeSide: 'SPOUSE',
    reciprocalCode: 'CHULAT_SADU',
    mr: 'चुलत मेव्हणी',
    en: 'Cousin Sister-in-law',
  },
  {
    code: 'CHULAT_SUNRE',
    category: 'FAMILY' as const,
    targetGender: 'FEMALE' as const,
    treeLevel: 0,
    treeSide: 'SPOUSE',
    reciprocalCode: 'CHULAT_MEVHANA',
    mr: 'चुलत सुनरे',
    en: "Cousin Brother-in-law's Wife",
  },
  {
    code: 'CHULAT_SADU',
    category: 'FAMILY' as const,
    targetGender: 'MALE' as const,
    treeLevel: 0,
    treeSide: 'SPOUSE',
    reciprocalCode: 'CHULAT_MEVHANI',
    mr: 'चुलत साडू',
    en: "Cousin Sister-in-law's Husband",
  },
  {
    code: 'CHULAT_BHACHA',
    category: 'FAMILY' as const,
    targetGender: 'MALE' as const,
    treeLevel: -1,
    treeSide: 'ROOT',
    reciprocalCode: 'MAMA',
    mr: 'चुलत भाचा',
    en: 'Cousin Nephew',
  },
  {
    code: 'CHULAT_BHACHI',
    category: 'FAMILY' as const,
    targetGender: 'FEMALE' as const,
    treeLevel: -1,
    treeSide: 'ROOT',
    reciprocalCode: 'MAMA',
    mr: 'चुलत भाची',
    en: 'Cousin Niece',
  },
];

export async function ensureEssentialRelationTypes(): Promise<void> {
  for (const item of ESSENTIAL_TYPES) {
    try {
      await prisma.relationType.upsert({
        where: { code: item.code },
        update: {
          category: item.category,
          targetGender: item.targetGender,
          treeLevel: item.treeLevel,
          treeSide: item.treeSide,
          reciprocalCode: item.reciprocalCode,
        },
        create: {
          code: item.code,
          category: item.category,
          targetGender: item.targetGender,
          treeLevel: item.treeLevel,
          treeSide: item.treeSide,
          reciprocalCode: item.reciprocalCode,
        },
      });

      // mr translation
      await prisma.relationTranslation.upsert({
        where: {
          relationTypeCode_languageCode_community: {
            relationTypeCode: item.code,
            languageCode: 'mr',
            community: '',
          },
        },
        update: { label: item.mr },
        create: {
          relationTypeCode: item.code,
          languageCode: 'mr',
          community: '',
          label: item.mr,
        },
      }).catch(async () => {
        // Fallback if unique constraint without community uses null
        const existing = await prisma.relationTranslation.findFirst({
          where: { relationTypeCode: item.code, languageCode: 'mr' },
        });
        if (existing) {
          await prisma.relationTranslation.update({
            where: { id: existing.id },
            data: { label: item.mr },
          });
        } else {
          await prisma.relationTranslation.create({
            data: {
              relationTypeCode: item.code,
              languageCode: 'mr',
              label: item.mr,
            },
          });
        }
      });

      // en translation
      await prisma.relationTranslation.upsert({
        where: {
          relationTypeCode_languageCode_community: {
            relationTypeCode: item.code,
            languageCode: 'en',
            community: '',
          },
        },
        update: { label: item.en },
        create: {
          relationTypeCode: item.code,
          languageCode: 'en',
          community: '',
          label: item.en,
        },
      }).catch(async () => {
        const existing = await prisma.relationTranslation.findFirst({
          where: { relationTypeCode: item.code, languageCode: 'en' },
        });
        if (existing) {
          await prisma.relationTranslation.update({
            where: { id: existing.id },
            data: { label: item.en },
          });
        } else {
          await prisma.relationTranslation.create({
            data: {
              relationTypeCode: item.code,
              languageCode: 'en',
              label: item.en,
            },
          });
        }
      });
    } catch (e) {
      log.warn({ err: e, code: item.code }, 'Failed to ensure essential relation type');
    }
  }

  // Update MAMI_SASRA translation to MAME_SASRA label 'मामे सासरा'
  try {
    const mamiSasraTranslations = await prisma.relationTranslation.findMany({
      where: { relationTypeCode: 'MAMI_SASRA', languageCode: 'mr' },
    });
    for (const t of mamiSasraTranslations) {
      await prisma.relationTranslation.update({
        where: { id: t.id },
        data: { label: 'मामे सासरा' },
      });
    }
  } catch (err) {
    // Ignore if not found
  }
}

/** Warms the cache at boot so the first request does not pay for the load. */
export async function warmRelationTypeRegistry(): Promise<void> {
  try {
    await ensureEssentialRelationTypes();
    const registry = await getRelationTypeRegistry();
    log.info({ types: registry.size }, 'relation type registry warmed');
  } catch (err) {
    log.warn({ err }, 'relation type registry warm-up failed (will retry on first request)');
  }
}
