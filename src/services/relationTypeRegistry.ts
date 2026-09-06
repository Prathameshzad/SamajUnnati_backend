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

/** Warms the cache at boot so the first request does not pay for the load. */
export async function warmRelationTypeRegistry(): Promise<void> {
  try {
    const registry = await getRelationTypeRegistry();
    log.info({ types: registry.size }, 'relation type registry warmed');
  } catch (err) {
    log.warn({ err }, 'relation type registry warm-up failed (will retry on first request)');
  }
}
