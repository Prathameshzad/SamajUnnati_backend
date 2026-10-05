// src/controllers/relationController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { createNotification } from '../services/notificationService';
import {
  RELATION_AXIS_CONFIG,
  SPOUSE_PAIRS,
  RELATION_LEVEL_MAP,
} from '../utils/relationMetadata';
import { TreeCacheService } from '../services/treeCacheService';
import {
  awardPointsInTransaction,
  emitScoreUpdate,
  lockScoreOwnerInTransaction,
  reverseRelationPointsInTransaction,
} from '../services/scoreService';
import { getUserBadgeData } from '../services/badgeService';
import {
  getRelationTypeRegistry,
  type RelationTypeRegistry,
} from '../services/relationTypeRegistry';
import { composeRelations } from '../utils/relationComposition';
import { badRequest, forbidden, notFound, unauthenticated } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('relations');

/**
 * Field set returned for the "other person" in a relation.
 *
 * `listRelations` already hand-picked these fields; `getTree`, `getRequests` and
 * `getAcceptedRequests` used `include: { fromUser: true, toUser: true }`, which
 * returns *every* User column — including `email`, `address`, `pincode`,
 * `dateOfBirth` and `bloodGroup` — for every person in the response. Selecting
 * explicitly keeps that PII out of the payload and shrinks the response.
 */
export const RELATION_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  gender: true,
  phone: true,
  area: true,
  isAlive: true,
  dateOfBirth: true,
  dateOfDeath: true,
  bloodGroup: true,
  profileCompleted: true,
  isRegistered: true,
} as const;

type GenderValue = 'MALE' | 'FEMALE' | null;

function normalizeGender(gender?: string | null): GenderValue {
  if (!gender) return null;
  const g = String(gender).trim().toUpperCase();
  if (g === 'MALE') return 'MALE';
  if (g === 'FEMALE') return 'FEMALE';
  return null;
}

function normalizeVisualSide(side?: string | null): 'top' | 'bottom' | 'left' | 'right' | null {
  if (side === 'top' || side === 'bottom' || side === 'left' || side === 'right') return side;
  return null;
}

/**
 * Resolve display label for a relation type based on language.
 * Kept for the few places that still hold a Prisma relationType object.
 */
function resolveLabel(relationType: any, lang: string = 'mr') {
  if (!relationType || !relationType.translations) return relationType?.code || 'UNKNOWN';
  const trans = relationType.translations.find((t: any) => t.languageCode === lang) || relationType.translations[0];
  return trans ? trans.label : relationType.code;
}

/**
 * Resolve which relation code and label should be shown to the given viewer.
 *
 * PERFORMANCE FIX: this used to be `async` and, on the incoming-side branch, ran
 *
 *     await prisma.relationType.findUnique({ where: { code: reciprocalCode },
 *                                            include: { translations: true } })
 *
 * once per relation. Because every caller invoked it inside
 * `Promise.all(raw.map(...))`, a user with N relations issued up to N extra
 * queries per request — for rows from a small, near-static reference table. It is
 * now a synchronous lookup against the cached registry, so those endpoints do a
 * fixed number of queries regardless of tree size.
 *
 * Resolution order is unchanged.
 */
function resolveRelationForViewer(
  registry: RelationTypeRegistry,
  rel: any,
  viewerUserId: string,
  lang: string = 'mr'
): { code: string; label: string } {
  if (rel.fromUserId === viewerUserId) {
    return { code: rel.relationTypeCode, label: registry.label(rel.relationTypeCode, lang) };
  }

  if (rel.toUserId === viewerUserId) {
    const reciprocalCode = registry.reciprocalOf(rel.relationTypeCode);
    return { code: reciprocalCode, label: registry.label(reciprocalCode, lang) };
  }

  return { code: rel.relationTypeCode, label: registry.label(rel.relationTypeCode, lang) };
}

/**
 * Notification creation now lives in `services/notificationService`, which
 * persists the row, emits it over Socket.IO *and* dispatches an FCM push so it
 * reaches the device when the app is closed. The local copy of this helper only
 * did the first two, and an identical copy existed in `friendController`.
 *
 * Call sites are unchanged — the imported function takes the same shape.
 */

function resolveNodeForViewer(nodeUser: any, relation: any, viewerUserId: string) {
  if (!relation) return nodeUser;
  const isMyOutgoing = relation.fromUserId === viewerUserId;

  if (isMyOutgoing) {
    return {
      ...nodeUser,
      firstName: relation.customName || nodeUser.firstName,
      photoUrl: relation.customPhotoUrl || nodeUser.photoUrl,
      originalFirstName: nodeUser.firstName,
      originalPhotoUrl: nodeUser.photoUrl,
    };
  }
  return nodeUser;
}

export const listRelations = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const registry = await getRelationTypeRegistry();

  // Fetch all relation rows relevant to this user:
  // 1. Rows they created (their own outgoing adds, including now-REJECTED cross-node originals)
  // 2. CONFIRMED rows where they are toUserId (reciprocal rows created by the other party pointing back to them)
  // 3. REJECTED rows where they are toUserId (so they can see rejections)
  const raw = await prisma.relation.findMany({
      where: {
        OR: [
          { createdById: userId },
          { toUserId: userId, status: 'CONFIRMED' },
          { toUserId: userId, status: 'REJECTED', createdById: { not: userId } },
        ],
      },
      // `relationType` is no longer joined: labels come from the cached registry,
      // which removes a join and the nested translations rows from every request.
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
        relationTypeCode: true,
        category: true,
        customName: true,
        customPhotoUrl: true,
        createdById: true,
        createdAt: true,
        fromUser: { select: RELATION_USER_SELECT },
        toUser: { select: RELATION_USER_SELECT },
        User_Relation_createdByIdToUser: { select: RELATION_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    // De-duplicate: for a confirmed connection, both the original row AND a reciprocal row
    // may appear. Always prefer the CONFIRMED row. Key by sorted user-pair + relation type.
    const deduped = new Map<string, typeof raw[0]>();
    for (const rel of raw) {
      const pair = [rel.fromUserId, rel.toUserId].sort().join(':') + ':' + rel.relationTypeCode;
      const existing = deduped.get(pair);
      if (!existing || (rel.status === 'CONFIRMED' && existing.status !== 'CONFIRMED')) {
        deduped.set(pair, rel);
      }
    }

    // No longer `Promise.all(async ...)`: label resolution is synchronous now,
    // so this is a plain map with zero database access.
    const relations = Array.from(deduped.values()).map(rel => {
      const view = resolveRelationForViewer(registry, rel, userId, lang);
      const isMyRelation = rel.createdById === userId;

      // Use createdById as the primary 'from' identifier for the relations list.
      // This ensures that if Root added KAKA from VADIL's node, both Root and KAKA see Root as the logical sender.
      const logicalFromUser = (rel as any).User_Relation_createdByIdToUser || rel.fromUser;
      const logicalFromUserId = rel.createdById || rel.fromUserId;

      let finalToUser = rel.toUser;
      if (logicalFromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }

      return {
        id: rel.id,
        fromUserId: logicalFromUserId,
        toUserId: rel.toUserId,
        status: rel.status,
        relationTypeCode: rel.relationTypeCode,
        category: rel.category,
        customName: isMyRelation ? rel.customName : null,
        customPhotoUrl: isMyRelation ? rel.customPhotoUrl : null,
        createdById: rel.createdById,
        createdAt: rel.createdAt,
        fromUser: logicalFromUser ? {
          id: logicalFromUser.id,
          firstName: logicalFromUser.firstName,
          lastName: logicalFromUser.lastName,
          photoUrl: logicalFromUser.photoUrl,
          gender: logicalFromUser.gender,
          phone: logicalFromUser.phone,
          area: logicalFromUser.area,
          isAlive: logicalFromUser.isAlive,
        } : null,
        toUser: finalToUser ? {
          id: finalToUser.id,
          firstName: finalToUser.firstName,
          lastName: finalToUser.lastName,
          photoUrl: finalToUser.photoUrl,
          gender: finalToUser.gender,
          phone: finalToUser.phone,
          area: finalToUser.area,
          isAlive: finalToUser.isAlive,
        } : null,
        relationType: { label: view.label, code: view.code }
      };
    });

    const filteredRelations = relations.filter(rel => {
      if (rel.status === 'PENDING') {
        const isMyRelation = rel.fromUserId === userId || rel.createdById === userId;
        const relativeUser = isMyRelation ? rel.toUser : rel.fromUser;
        if (!relativeUser) return false;
        if (relativeUser.isAlive === false) return false;
        if (!relativeUser.phone || !String(relativeUser.phone).trim()) return false;
      }
      return true;
    });

    return res.json(filteredRelations);
};

export const getTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const registry = await getRelationTypeRegistry();

  {
    // `rootUser` previously used `findUnique` with no select, returning every
    // column of the caller's own row. That is the caller's own data so it is not
    // a leak, but it is needless bytes on the wire.
    const rootUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        gender: true,
        phone: true,
        area: true,
        isAlive: true,
        dateOfBirth: true,
        dateOfDeath: true,
        bloodGroup: true,
        education: true,
        occupation: true,
        maritalStatus: true,
        pincode: true,
        address: true,
      },
    });
    const raw = await prisma.relation.findMany({
      where: {
        OR: [
          // Only fetch rows the viewer created themselves.
          // For cross-node adds (Root added KAKA from VADIL), the original row
          // (VADIL→KAKA) is now REJECTED at approval time, so it won't appear here.
          // Root sees their own outgoing row; KAKA sees their own reciprocal row.
          { createdById: userId },
          // Also include confirmed relations where viewer is fromUserId
          // (handles the normal self-add case & reciprocal rows)
          { fromUserId: userId, status: 'CONFIRMED' },
        ]
      },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
        relationTypeCode: true,
        category: true,
        customName: true,
        customPhotoUrl: true,
        visualSide: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        fromUser: { select: RELATION_USER_SELECT },
        toUser: { select: RELATION_USER_SELECT },
        User_Relation_createdByIdToUser: { select: RELATION_USER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });

    const relations = raw.map(rel => {
      const view = resolveRelationForViewer(registry, rel, userId, lang);
      const isMyRelation = rel.createdById === userId;
      let finalToUser = rel.toUser;
      if (rel.fromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }
      return {
        ...rel,
        customName: isMyRelation ? rel.customName : null,
        customPhotoUrl: isMyRelation ? rel.customPhotoUrl : null,
        toUser: finalToUser,
        relationType: { label: view.label, code: view.code }
      };
    });

    return res.json({ rootUser, relations });
  }
};

export const getRequests = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const registry = await getRelationTypeRegistry();

  {
    const raw = await prisma.relation.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
        relationTypeCode: true,
        category: true,
        customName: true,
        customPhotoUrl: true,
        visualSide: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        fromUser: { select: RELATION_USER_SELECT },
        toUser: { select: RELATION_USER_SELECT },
        User_Relation_createdByIdToUser: { select: RELATION_USER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });

    const pending = raw.map(rel => {
      const view = resolveRelationForViewer(registry, rel, userId, lang);

      // Normalize: show the actual root user who added the request as fromUserId/fromUser.
      const logicalFromUser = (rel as any).User_Relation_createdByIdToUser || rel.fromUser;
      const logicalFromUserId = rel.createdById || rel.fromUserId;

      return {
        ...rel,
        fromUserId: logicalFromUserId,
        fromUser: logicalFromUser,
        relationType: { label: view.label, code: view.code }
      };
    });

    const filteredPending = pending.filter(rel => {
      const sender = rel.fromUser;
      if (!sender) return false;
      if (sender.isAlive === false) return false;
      if (!sender.phone || !String(sender.phone).trim()) return false;
      return true;
    });

    return res.json(filteredPending);
  }
};

function normalizePhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/** Match both the current 10-digit format and legacy Indian numbers with 91. */
function phoneLookupVariants(normalizedPhone: string): string[] {
  return normalizedPhone.length === 10
    ? [normalizedPhone, `91${normalizedPhone}`]
    : [normalizedPhone];
}

/**
 * Confirms the caller may anchor a new relation to `sourceUserId`.
 *
 * AUTHORIZATION FIX. `createRelation` did:
 *
 *     const fromUserId = sourceUserId || userId;
 *
 * with `sourceUserId` taken straight from the request body and never checked.
 * The legitimate use is a cross-node add — "Root adds KAKA from VADIL's node" —
 * where VADIL is a node in Root's own tree. But because nothing verified that,
 * any authenticated user could pass an arbitrary user ID and create relation rows
 * anchored to a stranger's node, injecting entries into someone else's tree and
 * generating notifications that appear to come from them.
 *
 * A node counts as being in the caller's tree if the caller is a party to, or the
 * creator of, any non-rejected relation touching it.
 */
export async function assertSourceNodeOwned(userId: string, sourceUserId: string): Promise<void> {
  if (sourceUserId === userId) return;

  const link = await prisma.relation.findFirst({
    where: {
      status: { not: 'REJECTED' },
      OR: [
        { createdById: userId, fromUserId: sourceUserId },
        { createdById: userId, toUserId: sourceUserId },
        { fromUserId: userId, toUserId: sourceUserId },
        { fromUserId: sourceUserId, toUserId: userId },
      ],
    },
    select: { id: true },
  });

  if (!link) {
    log.warn({ userId, sourceUserId }, 'rejected relation anchored to a node outside the caller tree');
    throw forbidden('You can only add relations from nodes in your own tree');
  }
}

export const createRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const {
    phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl, isAlive, dateOfBirth, dateOfDeath, bloodGroup,
    education, occupation, maritalStatus, pincode, address, area, visualSide
  } = req.body;
  const fromUserId = sourceUserId || userId;

  if (sourceUserId) {
    await assertSourceNodeOwned(userId, sourceUserId);
  }

  const isPersonAlive = isAlive !== undefined ? (String(isAlive) === 'true') : true;

  let parsedDob: Date | null = null;
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    if (!isNaN(d.getTime())) parsedDob = d;
  }

  let parsedDateOfDeath: Date | null = null;
  if (!isPersonAlive && dateOfDeath) {
    const d = new Date(dateOfDeath);
    if (!isNaN(d.getTime())) parsedDateOfDeath = d;
  }

  const cleanBloodGroup = (isPersonAlive && bloodGroup) ? String(bloodGroup).trim() : null;

  let cleanPhone = null;
  if (isPersonAlive && phone && String(phone).trim()) {
    cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      throw badRequest('Invalid phone number');
    }
  }

  const matchedExistingUser = cleanPhone
    ? await prisma.user.findFirst({
        where: { phone: { in: phoneLookupVariants(cleanPhone) } },
        // Prefer the actual account when both a legacy-prefixed user and a
        // placeholder exist for the same national number.
        orderBy: [
          { profileCompleted: 'desc' },
          { isRegistered: 'desc' },
        ],
      })
    : null;

  {
    const existingRelation = matchedExistingUser
      ? await prisma.relation.findFirst({
          where: {
            toUserId: userId,
            fromUserId: matchedExistingUser.id,
            category: 'FAMILY',
            status: 'CONFIRMED',
            hiddenByUserIds: { isEmpty: true }
          },
          include: {
            relationType: { include: { translations: true } },
            fromUser: true
          }
        })
      : null;

    if (existingRelation && isPersonAlive) {
      const reciprocalCode = existingRelation.relationType?.reciprocalCode || existingRelation.relationTypeCode;

      // Only handle reciprocal auto-fill if the relation being added matches the reciprocal relation
      if (relationTypeCode === reciprocalCode) {
        const displayLabel = resolveLabel(existingRelation.relationType, lang);

        const alreadyInTree = await prisma.relation.findFirst({
          where: {
            category: 'FAMILY',
            relationTypeCode: reciprocalCode,
            OR: [
              { fromUserId: userId, toUserId: existingRelation.fromUserId },
              { createdById: userId, toUserId: existingRelation.fromUserId },
            ],
            status: { in: ['CONFIRMED', 'PENDING'] },
            NOT: { hiddenByUserIds: { has: userId } },
          },
        });

        if (alreadyInTree) {
          throw badRequest(`This person is already added with relation: ${displayLabel}`);
        }

        // Create the reciprocal relation to add them to the tree manually
        const { reciprocalRelation, scoreUpdate } = await prisma.$transaction(async (tx) => {
          await lockScoreOwnerInTransaction(tx, userId);
          const saved = await tx.relation.upsert({
            where: {
              fromUserId_toUserId_relationTypeCode: {
                fromUserId: userId,
                toUserId: existingRelation.fromUserId,
                relationTypeCode: reciprocalCode,
              },
            },
            // Idempotent retry: never rewrite a terminal state or its owner.
            update: {},
            create: {
              fromUserId: userId,
              toUserId: existingRelation.fromUserId,
              relationTypeCode: reciprocalCode,
              category: 'FAMILY',
              status: 'CONFIRMED',
              createdById: userId,
            },
          });
          const score = await awardPointsInTransaction(
            tx,
            userId,
            'ADD_ALIVE',
            saved.id,
            `relation:${saved.id}:add`
          );
          return { reciprocalRelation: saved, scoreUpdate: score };
        });
        await TreeCacheService.invalidateUserTree(userId, existingRelation.fromUserId);
        emitScoreUpdate(scoreUpdate);

        return res.status(200).json({
          alreadyAccepted: true,
          message: `You have already accepted this person's request previously and this person was telling you ${displayLabel}. They are now added to your tree.`,
          relation: reciprocalRelation
        });
      }
    }

    const relType = await prisma.relationType.findUnique({
      where: { code: relationTypeCode },
      include: { translations: true }
    });

    if (!relType) {
      throw badRequest(`Invalid relation type: ${relationTypeCode}`);
    }
    if (relType.category !== 'FAMILY') {
      throw badRequest('Use the category-specific endpoint for non-family relations');
    }

    let relatedUser = matchedExistingUser;

    if (!relatedUser) {
      const creator = await prisma.user.findUnique({ where: { id: userId } });
      const baseWorldX = creator?.worldX || 0;
      const baseWorldY = creator?.worldY || 0;

      relatedUser = await prisma.user.create({
        data: {
          phone: cleanPhone,
          whatsapp: cleanPhone,
          firstName,
          lastName: lastName || null,
          gender: normalizeGender(gender || relType.targetGender),
          dateOfBirth: parsedDob,
          dateOfDeath: !isPersonAlive ? parsedDateOfDeath : null,
          bloodGroup: isPersonAlive ? cleanBloodGroup : null,
          education: education ? String(education).trim() : null,
          occupation: occupation ? String(occupation).trim() : null,
          maritalStatus: maritalStatus ? String(maritalStatus).trim() : null,
          pincode: pincode ? String(pincode).trim() : null,
          address: address ? String(address).trim() : null,
          area: area ? String(area).trim() : null,
          profileCompleted: false,
          isAlive: isPersonAlive,
          worldX: baseWorldX + (Math.random() - 0.5) * 2000,
          worldY: baseWorldY + (Math.random() - 0.5) * 2000,
        },
      });
    } else {
      // Existing user found (e.g. by phone) -> update profile fields if provided
      const updateFields: any = {};
      if (parsedDob) updateFields.dateOfBirth = parsedDob;
      if (isAlive !== undefined) {
        updateFields.isAlive = isPersonAlive;
        if (!isPersonAlive) {
          updateFields.bloodGroup = null;
          updateFields.dateOfDeath = parsedDateOfDeath;
        } else {
          updateFields.dateOfDeath = null;
          if (cleanBloodGroup) updateFields.bloodGroup = cleanBloodGroup;
        }
      } else if (!isPersonAlive) {
        updateFields.bloodGroup = null;
        if (parsedDateOfDeath) updateFields.dateOfDeath = parsedDateOfDeath;
      } else if (cleanBloodGroup) {
        updateFields.bloodGroup = cleanBloodGroup;
      }
      if (education) updateFields.education = String(education).trim();
      if (occupation) updateFields.occupation = String(occupation).trim();
      if (maritalStatus) updateFields.maritalStatus = String(maritalStatus).trim();
      if (pincode) updateFields.pincode = String(pincode).trim();
      if (address) updateFields.address = String(address).trim();
      if (area) updateFields.area = String(area).trim();

      if (Object.keys(updateFields).length > 0) {
        relatedUser = await prisma.user.update({
          where: { id: relatedUser.id },
          data: updateFields
        });
      }
    }

    if (relatedUser.id === fromUserId) {
      throw badRequest('Cannot create relation with yourself');
    }

    const { relation, scoreUpdate, isRecreating } = await prisma.$transaction(async (tx) => {
      await lockScoreOwnerInTransaction(tx, userId);

      // Block adding the same person with the exact same relation type if an active relation already exists
      const existingActiveRelation = await tx.relation.findFirst({
        where: {
          category: 'FAMILY',
          relationTypeCode,
          OR: [
            { fromUserId, toUserId: relatedUser.id },
            { createdById: userId, toUserId: relatedUser.id },
          ],
          status: { in: ['CONFIRMED', 'PENDING'] },
          NOT: { hiddenByUserIds: { has: userId } },
        },
      });

      if (existingActiveRelation) {
        const displayLabel = resolveLabel(relType, lang);
        throw badRequest(`This person is already added with relation: ${displayLabel}`);
      }

      const existing = await tx.relation.findUnique({
        where: {
          fromUserId_toUserId_relationTypeCode: {
            fromUserId,
            toUserId: relatedUser.id,
            relationTypeCode,
          },
        },
        select: { id: true, status: true, hiddenByUserIds: true },
      });

      const isRecreating = Boolean(
        existing && (existing.hiddenByUserIds.length > 0 || existing.status === 'REJECTED')
      );

      const savedRelation = await tx.relation.upsert({
        where: {
          fromUserId_toUserId_relationTypeCode: {
            fromUserId,
            toUserId: relatedUser.id,
            relationTypeCode,
          },
        },
        update: {
          ...(customName ? { customName } : {}),
          ...(customPhotoUrl ? { customPhotoUrl } : {}),
          visualSide: normalizeVisualSide(visualSide),
          ...(isRecreating
            ? {
                status: existing?.status === 'CONFIRMED' ? 'CONFIRMED' : (isPersonAlive ? 'PENDING' : 'CONFIRMED'),
                createdById: userId,
                hiddenByUserIds: [],
              }
            : {}),
        },
        create: {
          fromUserId,
          toUserId: relatedUser.id,
          relationTypeCode,
          category: 'FAMILY',
          status: isPersonAlive ? 'PENDING' : 'CONFIRMED',
          customName: customName || null,
          customPhotoUrl: customPhotoUrl || null,
          visualSide: normalizeVisualSide(visualSide),
          createdById: userId,
          hiddenByUserIds: [],
        },
        include: { toUser: true, fromUser: true },
      });

      const addReason = savedRelation.toUser.isAlive === false ? 'ADD_DECEASED' : 'ADD_ALIVE';
      const score = await awardPointsInTransaction(
        tx,
        savedRelation.createdById ?? userId,
        addReason,
        savedRelation.id,
        `relation:${savedRelation.id}:add`
      );
      return { relation: savedRelation, scoreUpdate: score, isRecreating };
    });

    const displayLabel = resolveLabel(relType, lang);
    const authUser = await prisma.user.findUnique({ where: { id: userId } });

    // Send notifications for alive relatives if points were awarded or if this is a re-created request
    if (isPersonAlive && (scoreUpdate.applied || isRecreating)) {
      if (relatedUser.phone) {
        await createNotification({
          userId: relatedUser.id,
          type: 'RELATION_REQUEST',
          title: 'New relation request',
          message: `${authUser?.firstName || 'Someone'} has added you to their family tree.`,
          relationId: relation.id,
        });
      }

      await createNotification({
        userId: userId,
        type: 'RELATION_REQUEST',
        title: 'Request Sent',
        message: `You added ${firstName}. Waiting for approval.`,
        relationId: relation.id,
      });
    }

    await TreeCacheService.invalidateUserTree(fromUserId, relatedUser.id, userId);
    emitScoreUpdate(scoreUpdate);

    return res.status(201).json({
      ...relation,
      relationType: { code: relationTypeCode, label: displayLabel }
    });
  }
};

export const approveRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) throw unauthenticated();

  const outcome = await prisma.$transaction(async (tx) => {
    const relation = await tx.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        status: true,
        category: true,
        hiddenByUserIds: true,
      },
    });

    if (!relation || relation.toUserId !== userId || relation.category !== 'FAMILY') {
      throw notFound('Family relation request not found or not authorized');
    }
    if (relation.status === 'CONFIRMED') {
      if (relation.hiddenByUserIds && relation.hiddenByUserIds.length > 0) {
        await tx.relation.update({
          where: { id },
          data: { hiddenByUserIds: [] },
        });
        await tx.relation.updateMany({
          where: {
            fromUserId: relation.toUserId,
            toUserId: relation.fromUserId,
            category: 'FAMILY',
          },
          data: { hiddenByUserIds: [] },
        });
        const current = await tx.relation.findUniqueOrThrow({ where: { id } });
        return { relation: current, transitioned: true, scoreUpdate: null };
      }
      return { relation, transitioned: false, scoreUpdate: null };
    }
    if (relation.status !== 'PENDING') {
      throw badRequest('Request is no longer pending');
    }

    await lockScoreOwnerInTransaction(tx, relation.createdById ?? relation.fromUserId);

    // Compare-and-set closes concurrent double approval: only one transaction
    // can change PENDING to CONFIRMED and therefore only one can award +20.
    const changed = await tx.relation.updateMany({
      where: { id, toUserId: userId, category: 'FAMILY', status: 'PENDING' },
      data: { status: 'CONFIRMED', approvedAt: new Date(), hiddenByUserIds: [] },
    });
    if (changed.count > 0) {
      await tx.relation.updateMany({
        where: {
          fromUserId: relation.toUserId,
          toUserId: relation.fromUserId,
          category: 'FAMILY',
        },
        data: { hiddenByUserIds: [] },
      });
    }
    if (changed.count === 0) {
      const current = await tx.relation.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'CONFIRMED') {
        throw badRequest('Request was rejected before it could be approved');
      }
      return { relation: current, transitioned: false, scoreUpdate: null };
    }

    const updated = await tx.relation.findUniqueOrThrow({ where: { id } });
    const creatorId = relation.createdById ?? relation.fromUserId;
    const scoreUpdate = await awardPointsInTransaction(
      tx,
      creatorId,
      'RELATION_APPROVED',
      relation.id,
      `relation:${relation.id}:approved`
    );
    return { relation: updated, transitioned: true, scoreUpdate };
  });

  if (outcome.transitioned) {
    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
    await createNotification({
      userId: outcome.relation.createdById ?? outcome.relation.fromUserId,
      type: 'RELATION_APPROVED',
      title: 'Relation approved',
      message: `${approver?.firstName || 'Your family member'} approved your request.`,
      relationId: outcome.relation.id,
    });
  }

  await TreeCacheService.invalidateUserTree(
    outcome.relation.fromUserId,
    outcome.relation.toUserId,
    outcome.relation.createdById,
    userId
  );
  emitScoreUpdate(outcome.scoreUpdate);
  return res.json(outcome.relation);
};

export const rejectRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) throw unauthenticated();

  const outcome = await prisma.$transaction(async (tx) => {
    const relation = await tx.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        status: true,
        category: true,
        toUser: { select: { firstName: true } },
      },
    });
    if (!relation || relation.toUserId !== userId || relation.category !== 'FAMILY') {
      throw notFound('Family relation request not found or not authorized');
    }
    if (relation.status === 'REJECTED') return { relation, transitioned: false };
    if (relation.status !== 'PENDING') throw badRequest('Request is no longer pending');

    await lockScoreOwnerInTransaction(tx, relation.createdById ?? relation.fromUserId);

    const changed = await tx.relation.updateMany({
      where: { id, toUserId: userId, category: 'FAMILY', status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    const updated = await tx.relation.findUniqueOrThrow({
      where: { id },
      include: { toUser: { select: { firstName: true } } },
    });
    if (changed.count === 0 && updated.status !== 'REJECTED') {
      throw badRequest('Request was approved before it could be rejected');
    }
    return { relation: updated, transitioned: changed.count === 1 };
  });

  if (outcome.transitioned) {
    await createNotification({
      userId: outcome.relation.createdById ?? outcome.relation.fromUserId,
      type: 'RELATION_REJECTED',
      title: 'Relation rejected',
      message: `${outcome.relation.toUser?.firstName || 'User'} rejected your request.`,
      relationId: outcome.relation.id,
    });
  }

  await TreeCacheService.invalidateUserTree(
    outcome.relation.fromUserId,
    outcome.relation.toUserId,
    outcome.relation.createdById,
    userId
  );
  return res.json(outcome.relation);
};

export const unfollowRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) throw unauthenticated();

  const outcome = await prisma.$transaction(async (tx) => {
    const relation = await tx.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        status: true,
        category: true,
        hiddenByUserIds: true,
      },
    });
    if (!relation) throw notFound('Relation not found');

    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = relation.createdById === userId;
    if (!isParticipant && !isCreator) throw forbidden('Not authorized to unfollow this relation');
    if (!['FAMILY', 'FRIEND'].includes(relation.category)) {
      throw badRequest('This relation category cannot be unfollowed here');
    }
    if (relation.status !== 'CONFIRMED') {
      throw badRequest('Only approved relations can be unfollowed');
    }

    await lockScoreOwnerInTransaction(tx, relation.createdById ?? relation.fromUserId);

    // Compare-and-set makes concurrent/repeated unfollow requests idempotent.
    const changed = await tx.relation.updateMany({
      where: {
        id,
        status: 'CONFIRMED',
        NOT: { hiddenByUserIds: { has: userId } },
      },
      data: { hiddenByUserIds: { push: userId } },
    });
    if (changed.count === 0) {
      return { relation, changed: false, scoreUpdate: null };
    }

    // The initiating viewer disappears from their tree; all viewers also lose
    // the green verified tick because hiddenByUserIds is now non-empty. Reverse
    // only the approval bonus: the original add still exists for the other tree.
    const updated = await tx.relation.findUniqueOrThrow({ where: { id } });
    const creatorId = relation.createdById ?? relation.fromUserId;
    const scoreUpdate = await reverseRelationPointsInTransaction(
      tx,
      creatorId,
      relation.id,
      'APPROVAL_ONLY'
    );
    return { relation: updated, changed: true, scoreUpdate };
  });

  await TreeCacheService.invalidateUserTree(
    outcome.relation.fromUserId,
    outcome.relation.toUserId,
    outcome.relation.createdById,
    userId
  );
  emitScoreUpdate(outcome.scoreUpdate);

  return res.json({ status: 'UNFOLLOWED', changed: outcome.changed });
};

export const updateRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const {
    targetUserId: bodyTargetUserId,
    customName, customPhotoUrl, relationTypeCode, phone, isAlive, dateOfBirth, dateOfDeath, bloodGroup,
    education, occupation, maritalStatus, pincode, address, area
  } = req.body;

  if (!userId) throw unauthenticated();

  {
    const relation = await prisma.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        customName: true,
        customPhotoUrl: true,
        relationTypeCode: true,
      },
    });

    if (!relation) {
      throw notFound('Relation not found');
    }

    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = relation.createdById === userId;

    if (!isParticipant && !isCreator) {
      throw forbidden('Not authorized to edit this relation');
    }

    const updateData: any = {
      customName: customName !== undefined ? customName : relation.customName,
      customPhotoUrl: customPhotoUrl !== undefined ? customPhotoUrl : relation.customPhotoUrl
    };

    const updated = await prisma.relation.update({
      where: { id },
      data: updateData
    });

    // Update target relative user's profile fields if specified
    const targetUserData: any = {};
    if (customPhotoUrl !== undefined) targetUserData.photoUrl = customPhotoUrl ? String(customPhotoUrl).trim() : null;
    if (isAlive !== undefined) {
      const aliveBool = Boolean(isAlive);
      targetUserData.isAlive = aliveBool;
      if (!aliveBool) {
        targetUserData.bloodGroup = null;
        if (dateOfDeath !== undefined) {
          targetUserData.dateOfDeath = dateOfDeath ? new Date(dateOfDeath) : null;
        }
      } else {
        targetUserData.dateOfDeath = null;
        if (bloodGroup !== undefined) {
          targetUserData.bloodGroup = bloodGroup ? String(bloodGroup).trim() : null;
        }
      }
    } else {
      if (dateOfDeath !== undefined) {
        targetUserData.dateOfDeath = dateOfDeath ? new Date(dateOfDeath) : null;
      }
      if (bloodGroup !== undefined) {
        targetUserData.bloodGroup = bloodGroup ? String(bloodGroup).trim() : null;
      }
    }
    if (dateOfBirth !== undefined) {
      if (dateOfBirth) {
        const d = new Date(dateOfBirth);
        targetUserData.dateOfBirth = !isNaN(d.getTime()) ? d : null;
      } else {
        targetUserData.dateOfBirth = null;
      }
    }
    if (education !== undefined) targetUserData.education = education ? String(education).trim() : null;
    if (occupation !== undefined) targetUserData.occupation = occupation ? String(occupation).trim() : null;
    if (maritalStatus !== undefined) targetUserData.maritalStatus = maritalStatus ? String(maritalStatus).trim() : null;
    if (pincode !== undefined) targetUserData.pincode = pincode ? String(pincode).trim() : null;
    if (address !== undefined) targetUserData.address = address ? String(address).trim() : null;
    if (area !== undefined) targetUserData.area = area ? String(area).trim() : null;

    let resolvedTargetUserId = bodyTargetUserId;
    if (!resolvedTargetUserId) {
      if (relation.fromUserId === userId) {
        resolvedTargetUserId = relation.toUserId;
      } else if (relation.toUserId === userId) {
        resolvedTargetUserId = relation.fromUserId;
      } else {
        resolvedTargetUserId = relation.createdById === userId ? relation.toUserId : relation.fromUserId;
      }
    }

    if (Object.keys(targetUserData).length > 0) {
      /**
       * The four `console.log` calls that were here ran on every single call and
       * serialised `targetUserData` — which contains address, pincode, date of
       * birth and blood group — straight into stdout. That is PII in plaintext
       * logs on a hot write path. Replaced with a debug-level record of the field
       * *names* only, which is level-gated off in production.
       */
      log.debug(
        { fields: Object.keys(targetUserData), relationId: id },
        'updating related user profile'
      );

      if (resolvedTargetUserId) {
        // AUTHORIZATION: only write to a user who is actually the counterparty of
        // this relation. `targetUserId` arrives in the request body, and the
        // original code passed it to `prisma.user.update` unchecked whenever it
        // was present — so any participant of any relation could overwrite an
        // arbitrary user's profile fields by supplying their ID.
        const counterpartyIds = new Set(
          [relation.fromUserId, relation.toUserId, relation.createdById].filter(
            (value): value is string => typeof value === 'string'
          )
        );

        if (!counterpartyIds.has(resolvedTargetUserId)) {
          log.warn(
            { userId, resolvedTargetUserId, relationId: id },
            'rejected profile write to a user outside this relation'
          );
          throw forbidden('Cannot modify a user who is not part of this relation');
        }

        await prisma.user.update({
          where: { id: resolvedTargetUserId },
          data: targetUserData
        });
      } else {
        log.warn({ relationId: id }, 'no target user resolved; profile not updated');
      }
    }

    await TreeCacheService.invalidateUserTree(
      relation.fromUserId,
      relation.toUserId,
      relation.createdById,
      userId,
      resolvedTargetUserId,
      bodyTargetUserId
    );

    return res.json({ ...updated, isAlive });
  }
};

export const getFullTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  // Validated and capped by getFullTreeSchema (1..25, default 10).
  const maxDepth = Number(req.query.depth) || 10;
  const category = req.query.category as string;

  /**
   * Read-through cache with single-flight.
   *
   * Previously: `getFullTreeCache` then, on a miss, build and `setFullTreeCache`.
   * That leaves a stampede window — when a popular key expires, every concurrent
   * request for it runs the whole BFS against Postgres simultaneously. This is the
   * most expensive query in the application, so that window is exactly where an
   * outage starts. `readThroughFullTree` lets one request rebuild while the others
   * wait briefly for the result.
   */
  const { value: responseData, hit } = await TreeCacheService.readThroughFullTree(
    userId,
    maxDepth,
    lang,
    category,
    async () => {
    const rootUserDb = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        gender: true,
        isAlive: true,
        phone: true,
        profileCompleted: true,
        isRegistered: true,
      }
    });
    if (!rootUserDb) throw notFound('User not found');
    const rootUser = rootUserDb;

    const visited = new Map<string, { gen: number, code: string }>();
    visited.set(userId, { gen: 0, code: 'ROOT' });

    const processedRelations = new Set<string>();
    const allRelations: any[] = [];

    /**
     * Relation types come from the shared cached registry instead of
     * `prisma.relationType.findMany({ include: { translations: true } })` on every
     * call. That query fetched the entire reference table plus all translations
     * per request; it is now loaded once per process and refreshed on a TTL.
     *
     * `require('../utils/relationMetadata')` mid-function has also been replaced
     * with a static import at the top of the file — a synchronous `require` inside
     * a request handler blocks the event loop on first call and defeats bundling.
     */
    const registry = await getRelationTypeRegistry();

    const resolveRelationWithCache = (rel: any, viewerUserId: string, lang: string = 'mr') => {
      if (rel.fromUserId === viewerUserId) {
        return {
          code: rel.relationTypeCode,
          label: registry.label(rel.relationTypeCode, lang)
        };
      }
      if (rel.toUserId === viewerUserId) {
        const reciprocalCode = registry.reciprocalOf(rel.relationTypeCode);
        return {
          code: reciprocalCode,
          label: registry.label(reciprocalCode, lang)
        };
      }
      return {
        code: rel.relationTypeCode,
        label: registry.label(rel.relationTypeCode, lang)
      };
    };

    let queue = [userId];
    const nodesByGen = new Map<number, any[]>();
    nodesByGen.set(0, [{
      user: rootUser,
      relation: { id: `root-${userId}`, status: 'ROOT', relationType: { code: 'ROOT', label: 'You' } }
    }]);

    /**
     * Frontier batch size.
     *
     * The BFS builds `IN (...)` lists from the previous hop's node set. On a dense
     * tree that list grows without bound, producing a single query with thousands
     * of bind parameters — slow to plan and capable of exceeding the parameter
     * limit outright. Batching keeps each query a predictable size without
     * changing which relations are visited.
     */
    const FRONTIER_BATCH_SIZE = 500;

    const chunk = <T,>(items: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
      return out;
    };

    let hop = 0;
    while (queue.length > 0 && hop < maxDepth) {
      const nextQueue = new Set<string>();
      // Position lookup for the current frontier, replacing a per-relation scan.
      const queueIndex = new Map(queue.map((id, index) => [id, index]));

      const relationSelect = {
          id: true,
          fromUserId: true,
          toUserId: true,
          relationTypeCode: true,
          category: true,
          status: true,
          customName: true,
          customPhotoUrl: true,
          visualSide: true,
          createdById: true,
          hiddenByUserIds: true,
          createdAt: true,
          updatedAt: true,
          fromUser: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              gender: true,
              isAlive: true,
              profileCompleted: true,
              isRegistered: true,
            }
          },
          toUser: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              gender: true,
              isAlive: true,
              profileCompleted: true,
              isRegistered: true,
            }
          },
          // `relationType: true` removed: treeSide/treeLevel/reciprocalCode now come
          // from the cached registry, so this join no longer runs per hop.
        } as const;

      const batches = chunk(queue, FRONTIER_BATCH_SIZE);
      const rawRelations: any[] = (
        await Promise.all(
          batches.map((batch, batchIndex) =>
            prisma.relation.findMany({
              where: {
                OR: [
                  { fromUserId: { in: batch } },
                  { toUserId: { in: batch } },
                  // Only attach the creator clause once, on the first batch of the
                  // first hop, to preserve the original single-query semantics.
                  ...(hop === 0 && batchIndex === 0 ? [{ createdById: userId }] : []),
                ],
              },
              select: relationSelect,
            })
          )
        )
      ).flat();

      for (const rel of rawRelations) {
        if (processedRelations.has(rel.id)) continue;
        // Unfollowing is directional: hide this edge only from the caller's tree.
        // The confirmed relation row remains available to the other participant.
        if (rel.hiddenByUserIds?.includes(userId)) continue;
        if (category && rel.category !== category) continue;
        if (rel.status === 'REJECTED') {
          // If the user created this relation, keep it visible in their tree as REJECTED so they know the request was declined
          if (rel.createdById !== userId) continue;
        }

        const isCreator = rel.createdById === userId;
        const isFromMe = rel.fromUserId === userId;
        const isToMe = rel.toUserId === userId;
        const isConfirmed = rel.status === 'CONFIRMED';
        
        // For FAMILY category: Only show relations the user explicitly added/created themselves.
        // Incoming requests accepted by the user belong in their accepted/approval list,
        // and must NOT be auto-injected onto the visual Family Tree canvas unless explicitly added by the user.
        // For FRIENDS and other categories: reciprocal confirmed relations can be traversed.
        if (rel.category === 'FAMILY') {
          const retainedAfterOtherUnfollow =
            isConfirmed &&
            (isFromMe || isToMe || isCreator) &&
            rel.hiddenByUserIds?.length > 0 &&
            !rel.hiddenByUserIds.includes(userId);
          if (!isCreator && !retainedAfterOtherUnfollow) continue;
        } else {
          if (!isCreator && !isFromMe && !isToMe) continue;
          if (!isConfirmed && !isCreator) continue;
        }

        /**
         * Was `queue.find(id => id === rel.fromUserId || id === rel.toUserId)`,
         * a linear scan of the frontier for every relation in the hop — O(frontier
         * x relations), which is the quadratic term that made wide trees slow.
         *
         * `queueIndex` preserves the exact original semantics: `find` returns the
         * earliest match in queue order, so when both endpoints are in the frontier
         * the lower index wins.
         */
        const fromIndex = queueIndex.get(rel.fromUserId);
        const toIndex = queueIndex.get(rel.toUserId);
        // A viewer-created relation's fromUserId is the placement anchor selected
        // in the UI. If only its target is in this frontier, defer the edge until
        // the anchor is reached instead of permanently processing it backward.
        if (rel.createdById === userId && fromIndex === undefined) continue;

        // Relations created by this viewer use fromUserId as their explicit
        // placement anchor. Prefer it when both endpoints are in the frontier so
        // adding through another friend's node cannot flip the new edge around.
        const sourceId =
          rel.createdById === userId && fromIndex !== undefined
            ? rel.fromUserId
            : fromIndex !== undefined && (toIndex === undefined || fromIndex <= toIndex)
              ? rel.fromUserId
              : toIndex !== undefined
                ? rel.toUserId
                : undefined;
        if (!sourceId) continue;

        const neighborUser = (rel.fromUserId === sourceId) ? rel.toUser : rel.fromUser;
        const isOutgoing = (rel.fromUserId === sourceId);
        const targetId = neighborUser.id;
        const sourceData = visited.get(sourceId)!;
        const sourceGen = sourceData.gen;
        const visualSide = isOutgoing
          ? rel.visualSide
          : rel.visualSide === 'top'
            ? 'bottom'
            : rel.visualSide === 'bottom'
              ? 'top'
              : rel.visualSide === 'left'
                ? 'right'
                : rel.visualSide === 'right'
                  ? 'left'
                  : null;

        // Resolve the relation code from ROOT's perspective
        const rootView = resolveRelationWithCache(rel, userId, lang);

        processedRelations.add(rel.id);

        const targetViewCode = resolveRelationWithCache(rel, sourceId, lang).code;
        const visualSourceId = sourceId;

        // Only carry customName/customPhotoUrl when the viewer (Prathamesh) created
        // this relation row. For incoming relations (created by someone else, e.g. Vinesh
        // added Prathamesh as PUTANYA), the customName is what VINESH typed for PRATHAMESH
        // and must NOT be used as Vinesh's display name in Prathamesh's tree.
        const isViewerCreated = rel.createdById === userId;
        const rootRelationType = registry.get(rootView.code);
        allRelations.push({
          id: rel.id,
          fromUserId: rel.fromUserId,
          toUserId: rel.toUserId,
          relationType: {
            code: rootView.code,
            label: rootView.label,
            // Second operand was `rel.relationType?.treeSide` from the dropped join;
            // the registry lookup by the row's own code is equivalent.
            treeSide: rootRelationType?.treeSide ?? registry.get(rel.relationTypeCode)?.treeSide,
          },
          direction: isOutgoing ? 'OUTGOING' : 'INCOMING',
          sourceUserId: visualSourceId,
          status: rel.status,
          customName: isViewerCreated ? rel.customName : null,
          customPhotoUrl: isViewerCreated ? rel.customPhotoUrl : null,
          visualSide,
          createdById: rel.createdById,
          hiddenByUserIds: rel.hiddenByUserIds,
        });

        if (visited.has(targetId)) continue;

        // ─── LEVEL ASSIGNMENT ───────────────────────────────────────────
        // Step 1: Resolve the relation code from the TARGET's perspective viewing the edge
        const targetViewFromSource = resolveRelationWithCache(rel, sourceId, lang);
        const targetRelCode = targetViewFromSource.code;
        const targetRelationType = registry.get(targetRelCode);

        let localNeighborGen: number;
        const canonicalLevel = RELATION_LEVEL_MAP[targetRelCode];

        // Dynamic level for NATEVAIK generic relative based on the side from
        // the current source node's perspective (already inverted when needed).
        if (targetRelCode === 'NATEVAIK') {
          if (visualSide === 'top') {
            let nextGen = sourceGen + 1;
            // When adding on top, never place onto the root level (gen 0). It must be at least gen 1 (above root).
            if (nextGen === 0) {
              nextGen = 1;
            }
            localNeighborGen = nextGen;
          } else if (visualSide === 'bottom') {
            localNeighborGen = sourceGen - 1;
          } else {
            localNeighborGen = sourceGen;
          }
        }
        // Step 2: Prefer canonical static generation from RELATION_LEVEL_MAP when available.
        // This protects against stale/mismatched DB treeLevel values for same-generation cousins.
        else if (canonicalLevel !== undefined) {
          localNeighborGen = canonicalLevel;
        } else if (targetRelationType?.treeLevel !== null && targetRelationType?.treeLevel !== undefined) {
          localNeighborGen = targetRelationType.treeLevel;
        } else {
          // Fallback: derive from direction delta
          const sourceRelCode = sourceData.code || 'ROOT';
          const isSpousePairEdge = SPOUSE_PAIRS.some(
            ([a, b]: [string, string]) =>
              (a === sourceRelCode && b === targetRelCode) ||
              (b === sourceRelCode && a === targetRelCode)
          );

          const axis = RELATION_AXIS_CONFIG[sourceRelCode];
          let axisDirection: 'UP' | 'DOWN' | 'SAME' | null = null;
          if (axis) {
            const allOpts = [
              ...(axis.xAxis?.left || []),
              ...(axis.xAxis?.right || []),
              ...(axis.yAxis?.top || []),
              ...(axis.yAxis?.bottom || []),
            ];
            const matched = allOpts.find(opt => opt.code === targetRelCode);
            axisDirection = matched?.direction || null;
          }

          const unitDelta = isSpousePairEdge
            ? 0
            : axisDirection === 'SAME'
              ? 0
              : axisDirection === 'UP'
                ? 1
                : axisDirection === 'DOWN'
                  ? -1
                  : 0;

          localNeighborGen = sourceGen + unitDelta;
        }
        // ────────────────────────────────────────────────────────────────

        visited.set(targetId, { gen: localNeighborGen, code: targetRelCode });
        if (rel.status !== 'REJECTED') {
          nextQueue.add(targetId);
        }

        if (!nodesByGen.has(localNeighborGen)) nodesByGen.set(localNeighborGen, []);

        let displayNeighbor = neighborUser;
        if (rel.createdById === userId && rel.toUserId === targetId) {
          displayNeighbor = resolveNodeForViewer(neighborUser, rel, userId);
        }

        nodesByGen.get(localNeighborGen)!.push({
          user: displayNeighbor,
          relation: allRelations[allRelations.length - 1]
        });
      }

      queue = Array.from(nextQueue);
      hop++;
    }

    const levels = [];
    for (const [gen, nodes] of nodesByGen.entries()) {
      levels.push({ level: gen, nodes });
    }
    return { rootUser, levels, allRelations };
    }
  );

  // Lets clients and dashboards see cache effectiveness without extra tooling.
  res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
  return res.json(responseData);
};

/**
 * Row cap for the spatial chunk query. Radius is already capped at 20,000 by
 * getGraphChunkSchema; this additionally bounds the result set itself, since a
 * dense cluster of users inside a large-but-valid radius could still return
 * everyone plus every one of their relations in a single response.
 */
const GRAPH_CHUNK_NODE_LIMIT = 500;

export const getGraphChunk = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  // Bounds already enforced by getGraphChunkSchema (radius capped at 20,000).
  const x = Number(req.query.x) || 0;
  const y = Number(req.query.y) || 0;
  const radius = Number(req.query.radius) || 5000;
  const lang = (req.query.lang as string) || 'mr';
  const registry = await getRelationTypeRegistry();

  // 1. Users within the bounding box. `take` caps the result regardless of how
  // densely populated the box is; `World(X|Y)` composite index (see the schema
  // migration) makes this a range scan instead of a sequential scan.
  const nodes = await prisma.user.findMany({
    where: {
      worldX: { gte: x - radius, lte: x + radius },
      worldY: { gte: y - radius, lte: y + radius },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      gender: true,
      isAlive: true,
      worldX: true,
      worldY: true,
    },
    take: GRAPH_CHUNK_NODE_LIMIT,
  });

  const nodeIds = nodes.map(n => n.id);

  // 2. Relations between the returned nodes only.
  // Registry lookup replaces `include: { relationType: { include: { translations: true } } }`,
  // removing a join across every relation in the chunk.
  const relations = nodeIds.length === 0 ? [] : await prisma.relation.findMany({
    where: {
      OR: [{ fromUserId: { in: nodeIds } }, { toUserId: { in: nodeIds } }],
      status: 'CONFIRMED',
    },
    select: { id: true, fromUserId: true, toUserId: true, relationTypeCode: true },
  });

  return res.json({
    chunkId: `chunk-${Math.floor(x / radius)}-${Math.floor(y / radius)}`,
    bounds: { x, y, radius },
    truncated: nodes.length === GRAPH_CHUNK_NODE_LIMIT,
    nodes,
    edges: relations.map(rel => ({
      id: rel.id,
      fromUserId: rel.fromUserId,
      toUserId: rel.toUserId,
      relationType: rel.relationTypeCode,
      label: registry.label(rel.relationTypeCode, lang),
    })),
  });
};

/**
 * Maintenance endpoint. Route-level `requireAdmin` already restricts this to
 * ADMIN_USER_IDS (see relationRoutes.ts); the query itself is fixed here.
 *
 * The previous version loaded every user row into memory
 * (`prisma.user.findMany()` with no select) and issued one UPDATE per row inside
 * a JS loop. Rewritten as a single `UPDATE ... WHERE worldX IS NULL OR worldY IS
 * NULL` — the database computes the random offsets and applies them in one
 * statement rather than N round-trips.
 */
export const initWorldCoords = async (_req: AuthRequest, res: Response) => {
  const result = await prisma.$executeRaw`
    UPDATE "User"
    SET "worldX" = (random() - 0.5) * 20000,
        "worldY" = (random() - 0.5) * 20000
    WHERE "worldX" IS NULL OR "worldY" IS NULL
  `;
  return res.json({ message: `Initialized coordinates for ${result} users.` });
};

export const getRelationCounts = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const [pending, confirmed, rejected, accepted, userCreatedRelations, confirmedRelations, badge] = await Promise.all([
    prisma.relation.count({
      where: {
        OR: [{ createdById: userId }, { fromUserId: userId }],
        status: 'PENDING',
        toUser: {
          isAlive: true,
          AND: [{ phone: { not: null } }, { phone: { not: '' } }],
        },
      },
    }),
    prisma.relation.count({
      where: { fromUserId: userId, status: 'CONFIRMED', hiddenByUserIds: { isEmpty: true } },
    }),
    prisma.relation.count({
      where: {
        OR: [{ createdById: userId }, { fromUserId: userId }],
        status: 'REJECTED',
      },
    }),
    prisma.relation.count({
      where: { toUserId: userId, status: 'CONFIRMED', hiddenByUserIds: { isEmpty: true } },
    }),
    prisma.relation.findMany({
      where: {
        OR: [
          { createdById: userId },
          { fromUserId: userId },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    }),
    prisma.relation.findMany({
      where: {
        hiddenByUserIds: { isEmpty: true },
        OR: [
          { fromUserId: userId, status: 'CONFIRMED' },
          { toUserId: userId, status: 'CONFIRMED' },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    }),
    // Cached and versioned — see badgeService.getUserBadgeData.
    getUserBadgeData(userId),
  ]);

  const nodeSet = new Set<string>();
  for (const r of userCreatedRelations) {
    if (r.fromUserId && r.fromUserId !== userId) nodeSet.add(r.fromUserId);
    if (r.toUserId && r.toUserId !== userId) nodeSet.add(r.toUserId);
  }
  const network = nodeSet.size;

  const approvedSet = new Set<string>();
  for (const r of confirmedRelations) {
    const partnerId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
    if (partnerId) approvedSet.add(partnerId);
  }
  const approved = approvedSet.size;

  return res.json({ pending, confirmed, rejected, accepted, network, approved, badge });
};

export const deleteRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) throw unauthenticated();

  const outcome = await prisma.$transaction(async (tx) => {
    const relation = await tx.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        status: true,
        category: true,
        relationTypeCode: true,
        relationType: { select: { reciprocalCode: true } },
        fromUser: { select: { firstName: true, isAlive: true } },
        toUser: { select: { firstName: true, isAlive: true } },
      },
    });
    if (!relation || relation.category !== 'FAMILY') {
      throw notFound('Family relation not found');
    }

    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = relation.createdById === userId;
    if (!isParticipant && !isCreator) throw forbidden('Not authorized to delete this relation');

    const creatorId = relation.createdById ?? relation.fromUserId;
    await lockScoreOwnerInTransaction(tx, creatorId);

    if (relation.status === 'CONFIRMED') {
      // Scope the counterpart update to the exact reciprocal family type. The old
      // query rejected every reverse relation between these users, including
      // unrelated FRIEND/MATRIMONY edges.
      await tx.relation.updateMany({
        where: {
          fromUserId: relation.toUserId,
          toUserId: relation.fromUserId,
          category: 'FAMILY',
          relationTypeCode: relation.relationType.reciprocalCode ?? relation.relationTypeCode,
          status: 'CONFIRMED',
        },
        data: { status: 'REJECTED' },
      });
    }

    await tx.notification.updateMany({
      where: { relationId: id },
      data: { relationId: null },
    });

    const scoreUpdate = await reverseRelationPointsInTransaction(
      tx,
      creatorId,
      relation.id,
      'ALL'
    );
    await tx.relation.delete({ where: { id } });
    return { relation, scoreUpdate };
  });

  await TreeCacheService.invalidateUserTree(
    outcome.relation.fromUserId,
    outcome.relation.toUserId,
    outcome.relation.createdById,
    userId
  );
  emitScoreUpdate(outcome.scoreUpdate);

  if (outcome.relation.status === 'CONFIRMED') {
    try {
      const otherUserId = outcome.relation.fromUserId === userId
        ? outcome.relation.toUserId
        : outcome.relation.fromUserId;
      const remover = outcome.relation.fromUserId === userId
        ? outcome.relation.fromUser
        : outcome.relation.toUser;
      const targetUser = outcome.relation.fromUserId === userId
        ? outcome.relation.toUser
        : outcome.relation.fromUser;
      if (otherUserId !== userId && targetUser?.isAlive !== false) {
        await createNotification({
          userId: otherUserId,
          type: 'RELATION_REJECTED',
          title: 'Connection removed',
          message: `${remover?.firstName || 'Someone'} has removed you from their family tree.`,
        });
      }
    } catch (notificationError) {
      log.warn(
        { err: notificationError, relationId: outcome.relation.id },
        'relation deleted but removal notification failed'
      );
    }
  }

  return res.json({ message: 'Relation deleted' });
};

export const getAcceptedRequests = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const registry = await getRelationTypeRegistry();

  const raw = await prisma.relation.findMany({
      where: { toUserId: userId, status: 'CONFIRMED' },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
        relationTypeCode: true,
        category: true,
        customName: true,
        customPhotoUrl: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        fromUser: { select: RELATION_USER_SELECT },
        toUser: { select: RELATION_USER_SELECT },
      },
      orderBy: { updatedAt: 'desc' },
      // Previously unbounded. A long-lived account would return its entire
      // confirmed-relation history on every call.
      take: 200,
    });

    const accepted = raw.map(rel => {
      const view = resolveRelationForViewer(registry, rel, userId, lang);
      return {
        ...rel,
        relationType: { label: view.label, code: view.code }
      };
    });

    return res.json(accepted);
};

export const checkAcceptedByPhone = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  // Presence/format already enforced by checkAcceptedByPhoneSchema.
  const { phone } = req.query as { phone: string };
  const lang = (req.query.lang as string) || 'en';
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) throw badRequest('Invalid phone');

  const registry = await getRelationTypeRegistry();

  const existingRelation = await prisma.relation.findFirst({
    where: {
      toUserId: userId,
      fromUser: { phone: cleanPhone },
      status: 'CONFIRMED'
    },
    select: {
      relationTypeCode: true,
      // Narrowed from `fromUser: true`: only the fields this response actually
      // exposes, rather than the caller's full profile (email, address, DOB...).
      fromUser: { select: RELATION_USER_SELECT },
    },
  });

  if (existingRelation) {
    const label = registry.label(existingRelation.relationTypeCode, lang);
    return res.json({
      accepted: true,
      message: `You have already accepted this person's request previously and this person was telling you ${label}.`,
      user: existingRelation.fromUser
    });
  }

  return res.json({ accepted: false });
};

// ─── Relation Suggestion Engine ──────────────────────────────────────────────

/**
 * Composition table: given (myRelationToIntermediary, intermediaryRelationToCandidate)
 * → suggested relation code for me→candidate.
 *
 * Pattern: [myCode, theirCode] → suggestedCode
 * Read as: "If intermediary is my {myCode} and candidate is intermediary's {theirCode},
 * then candidate is my {suggestedCode}."
 *
 * We only include the most common/clear-cut compositions to avoid false suggestions.
 * The reciprocal rows are handled by the API (candidate→me = reciprocalOf(suggestedCode)).
 */
/**
 * GET /relations/suggestions
 *
 * Returns a list of registered users that the current user might know, along
 * with the inferred relation code — based on 2nd-degree graph traversal over
 * CONFIRMED relations between registered users only.
 *
 * Supports both FAMILY and FRIEND trees via ?category=FAMILY (default) or ?category=FRIEND.
 */
export const getRelationSuggestions = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  const category = ((req.query.category as string) || 'FAMILY').toUpperCase() as 'FAMILY' | 'FRIEND';
  if (!userId) throw unauthenticated();

  const registry = await getRelationTypeRegistry();

  // Track all user IDs already connected to me (CONFIRMED or PENDING) to exclude from suggestions
  const alreadyConnected = new Set<string>([userId]);
  const allExistingRelations = await prisma.relation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'PENDING'] },
      deletedAt: null,
      NOT: { hiddenByUserIds: { has: userId } },
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
        { createdById: userId },
      ],
    },
    select: { fromUserId: true, toUserId: true },
  });
  for (const r of allExistingRelations) {
    alreadyConnected.add(r.fromUserId);
    alreadyConnected.add(r.toUserId);
  }

  // Map: candidateId → suggestion details
  const suggestions = new Map<string, {
    suggestedCode: string;
    suggestedLabel: string;
    intermediaryId: string;
    viaRelationCode: string;
    candidate: any;
    confidence: number;
  }>();

  if (category === 'FRIEND') {
    // ── FRIEND TREE RECOMMENDATIONS ──────────────────────────────────────────
    // 1. Find all CONFIRMED friends of the user involving registered users
    const myFriends = await prisma.relation.findMany({
      where: {
        category: 'FRIEND',
        status: 'CONFIRMED',
        deletedAt: null,
        NOT: { hiddenByUserIds: { has: userId } },
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
      select: {
        fromUserId: true,
        toUserId: true,
        relationTypeCode: true,
        fromUser: { select: { id: true, isRegistered: true } },
        toUser: { select: { id: true, isRegistered: true } },
      },
    });

    const friendIntermediaries = new Map<string, string>();
    for (const rel of myFriends) {
      if (rel.fromUserId === userId && rel.toUser?.isRegistered) {
        friendIntermediaries.set(rel.toUserId, rel.relationTypeCode);
      } else if (rel.toUserId === userId && rel.fromUser?.isRegistered) {
        friendIntermediaries.set(rel.fromUserId, rel.relationTypeCode);
      }
    }

    if (friendIntermediaries.size === 0) {
      return res.json([]);
    }

    const intermediaryIds = Array.from(friendIntermediaries.keys());

    // 2. Fetch CONFIRMED friends of all registered friend intermediaries
    const mutualRelations = await prisma.relation.findMany({
      where: {
        status: 'CONFIRMED',
        category: 'FRIEND',
        deletedAt: null,
        OR: [
          { fromUserId: { in: intermediaryIds } },
          { toUserId: { in: intermediaryIds } },
        ],
      },
      select: {
        fromUserId: true,
        toUserId: true,
        fromUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            gender: true,
            phone: true,
            area: true,
            isAlive: true,
            isRegistered: true,
            profileCompleted: true,
          },
        },
        toUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            gender: true,
            phone: true,
            area: true,
            isAlive: true,
            isRegistered: true,
            profileCompleted: true,
          },
        },
      },
    });

    for (const rel of mutualRelations) {
      let intermediaryId: string;
      let candidateId: string;
      let candidateUser: any;

      const fromIsIntermediary = friendIntermediaries.has(rel.fromUserId) && !friendIntermediaries.has(rel.toUserId);
      const toIsIntermediary = friendIntermediaries.has(rel.toUserId) && !friendIntermediaries.has(rel.fromUserId);

      if (fromIsIntermediary) {
        intermediaryId = rel.fromUserId;
        candidateId = rel.toUserId;
        candidateUser = rel.toUser;
      } else if (toIsIntermediary) {
        intermediaryId = rel.toUserId;
        candidateId = rel.fromUserId;
        candidateUser = rel.fromUser;
      } else {
        continue;
      }

      if (alreadyConnected.has(candidateId)) continue;
      if (!candidateUser?.isRegistered || candidateUser?.isAlive === false) continue;
      if (!candidateUser?.phone) continue;

      // Suggest MITRA for male/unspecified, MAITRIN for female
      const suggestedCode = candidateUser.gender === 'FEMALE' ? 'MAITRIN' : 'MITRA';
      const suggestedLabel = registry.label(suggestedCode, lang);
      const myCodeToIntermediary = friendIntermediaries.get(intermediaryId)!;

      const existing = suggestions.get(candidateId);
      if (!existing) {
        suggestions.set(candidateId, {
          suggestedCode,
          suggestedLabel,
          intermediaryId,
          viaRelationCode: myCodeToIntermediary,
          candidate: candidateUser,
          confidence: 1,
        });
      } else {
        // Boost confidence for multiple mutual friends
        existing.confidence += 1;
      }
    }
  } else {
    // ── FAMILY TREE RECOMMENDATIONS ──────────────────────────────────────────
    // 1. All CONFIRMED relations in my tree with registered users
    const treeRelations = await prisma.relation.findMany({
      where: {
        category: 'FAMILY',
        status: 'CONFIRMED',
        deletedAt: null,
        NOT: { hiddenByUserIds: { has: userId } },
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
          { createdById: userId },
        ],
      },
      select: {
        fromUserId: true,
        toUserId: true,
        relationTypeCode: true,
        createdById: true,
        fromUser: { select: { id: true, isRegistered: true } },
        toUser: { select: { id: true, isRegistered: true } },
      },
    });

    const intermediaries = new Map<string, string>();
    for (const rel of treeRelations) {
      if (rel.fromUserId === userId) {
        if (rel.toUser?.isRegistered) {
          intermediaries.set(rel.toUserId, rel.relationTypeCode);
        }
      } else if (rel.toUserId === userId) {
        if (rel.fromUser?.isRegistered) {
          intermediaries.set(rel.fromUserId, registry.reciprocalOf(rel.relationTypeCode));
        }
      } else if (rel.createdById === userId) {
        if (rel.toUser?.isRegistered) {
          intermediaries.set(rel.toUserId, rel.relationTypeCode);
        }
      }
    }

    if (intermediaries.size === 0) {
      return res.json([]);
    }

    const intermediaryIds = Array.from(intermediaries.keys());

    // 2. Fetch relations of all registered intermediaries
    const theirRelations = await prisma.relation.findMany({
      where: {
        status: 'CONFIRMED',
        category: 'FAMILY',
        deletedAt: null,
        OR: [
          { fromUserId: { in: intermediaryIds } },
          { toUserId: { in: intermediaryIds } },
        ],
      },
      select: {
        fromUserId: true,
        toUserId: true,
        relationTypeCode: true,
        fromUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            gender: true,
            phone: true,
            area: true,
            isAlive: true,
            isRegistered: true,
            profileCompleted: true,
          },
        },
        toUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            gender: true,
            phone: true,
            area: true,
            isAlive: true,
            isRegistered: true,
            profileCompleted: true,
          },
        },
      },
    });

    // 3. Compose relations using comprehensive composition rules
    for (const rel of theirRelations) {
      let intermediaryId: string;
      let candidateId: string;
      let intermediaryToCandidate: string;
      let candidateUser: any;

      const fromIsIntermediary = intermediaries.has(rel.fromUserId) && !intermediaries.has(rel.toUserId);
      const toIsIntermediary = intermediaries.has(rel.toUserId) && !intermediaries.has(rel.fromUserId);

      if (fromIsIntermediary) {
        intermediaryId = rel.fromUserId;
        candidateId = rel.toUserId;
        intermediaryToCandidate = rel.relationTypeCode;
        candidateUser = rel.toUser;
      } else if (toIsIntermediary) {
        intermediaryId = rel.toUserId;
        candidateId = rel.fromUserId;
        intermediaryToCandidate = registry.reciprocalOf(rel.relationTypeCode);
        candidateUser = rel.fromUser;
      } else {
        continue;
      }

      if (alreadyConnected.has(candidateId)) continue;
      if (!candidateUser?.isRegistered || candidateUser?.isAlive === false) continue;
      if (!candidateUser?.phone) continue;

      const myCodeToIntermediary = intermediaries.get(intermediaryId)!;
      const suggestedCode = composeRelations(myCodeToIntermediary, intermediaryToCandidate);

      if (!suggestedCode) continue;

      const relMeta = registry.get(suggestedCode);
      if (relMeta?.targetGender && candidateUser.gender && relMeta.targetGender !== candidateUser.gender) {
        continue;
      }

      const suggestedLabel = registry.label(suggestedCode, lang);

      const existing = suggestions.get(candidateId);
      const genderMatch = !relMeta?.targetGender || !candidateUser.gender || relMeta.targetGender === candidateUser.gender;
      const confidence = genderMatch ? 2 : 1;
      if (!existing || existing.confidence < confidence) {
        suggestions.set(candidateId, {
          suggestedCode,
          suggestedLabel,
          intermediaryId,
          viaRelationCode: myCodeToIntermediary,
          candidate: candidateUser,
          confidence,
        });
      }
    }
  }

  // ── Step 4: Format and return ─────────────────────────────────────────────
  const result = Array.from(suggestions.entries()).map(([candidateId, s]) => ({
    userId: candidateId,
    firstName: s.candidate.firstName,
    lastName: s.candidate.lastName,
    photoUrl: s.candidate.photoUrl,
    gender: s.candidate.gender,
    phone: s.candidate.phone,
    area: s.candidate.area,
    isRegistered: s.candidate.isRegistered,
    profileCompleted: s.candidate.profileCompleted,
    suggestedRelationCode: s.suggestedCode,
    suggestedRelationLabel: s.suggestedLabel,
    viaUserId: s.intermediaryId,
    viaRelationCode: s.viaRelationCode,
    viaRelationLabel: registry.label(s.viaRelationCode, lang),
  }));

  // Limit to top 25 suggestions
  return res.json(result.slice(0, 25));
};
