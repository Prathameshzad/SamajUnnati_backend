// src/services/relationReconnectService.ts
import prisma from '../lib/prisma';
import { createNotification } from './notificationService';
import { TreeCacheService } from './treeCacheService';
import { emitToUser } from '../lib/socket';
import { createLogger } from '../lib/logger';

const log = createLogger('relationReconnect');

export function phoneLookupVariants(rawPhone?: string | null): string[] {
  if (!rawPhone) return [];
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return [];
  const variants = new Set<string>();
  variants.add(digits);
  if (digits.length === 10) {
    variants.add(`91${digits}`);
    variants.add(`0${digits}`);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    variants.add(digits.slice(2));
  } else if (digits.length === 11 && digits.startsWith('0')) {
    variants.add(digits.slice(1));
  }
  return Array.from(variants);
}

function resolveLabel(relationType: any, lang: string = 'mr'): string {
  if (!relationType || !relationType.translations) return relationType?.code || 'Family Member';
  const trans =
    relationType.translations.find((t: any) => t.languageCode === lang) ||
    relationType.translations[0];
  return trans ? trans.label : relationType.code;
}

/**
 * Synchronizes and activates pending relation connection requests for a user upon
 * registration or login.
 *
 * This handles BOTH:
 * 1. Brand-new users who were previously added by phone into other users' trees
 *    (merges placeholder stubs and activates their relation requests).
 * 2. Re-registering deleted users who previously had relationships that were unlinked
 *    during account deletion (reclaims relations and brings them to pending status).
 *
 * For each pending connection:
 * - Links the relation directly to the registered user's ID (`toUserId = userId`).
 * - Keeps or sets the status to PENDING (unapproved).
 * - Dispatches in-app and push notifications for approval:
 *   "[Name] has added you as [Relation] to their family tree. Please approve to connect."
 * - Once approved, the connection is confirmed and the tick becomes visible.
 */
export async function syncPendingRelationsForUser(userId: string, rawPhone?: string | null): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, phone: true, appLanguage: true },
  });
  if (!user) return 0;

  const phone = rawPhone || user.phone;
  if (!phone) return 0;

  const variants = phoneLookupVariants(phone);
  log.info({ userId, phone, variants }, 'Syncing pending relation requests for user');

  let processedCount = 0;

  // ─── 1. CLAIM & MERGE ANY UNCOMPLETED PLACEHOLDERS WITH THIS PHONE OR WHATSAPP ───
  const matchingPlaceholders = await prisma.user.findMany({
    where: {
      OR: [
        { phone: { in: variants } },
        { whatsapp: { in: variants } },
      ],
      id: { not: userId },
      profileCompleted: false,
    },
    select: { id: true, phone: true },
  });

  for (const placeholder of matchingPlaceholders) {
    log.info({ placeholderId: placeholder.id, userId }, 'Merging placeholder user into registered user');

    // Transfer all incoming relations
    await prisma.relation.updateMany({
      where: { toUserId: placeholder.id },
      data: { toUserId: userId, status: 'PENDING' },
    });

    // Transfer all sub-relations branching from this placeholder
    await prisma.relation.updateMany({
      where: { fromUserId: placeholder.id },
      data: { fromUserId: userId },
    });

    // Delete orphaned notifications for placeholder
    await prisma.notification.deleteMany({
      where: { userId: placeholder.id },
    });

    // Clean up placeholder row
    await prisma.user.delete({
      where: { id: placeholder.id },
    }).catch((err) => {
      log.warn({ placeholderId: placeholder.id, err }, 'Failed to delete claimed placeholder user');
    });
  }

  // ─── 2. RECONNECT RELATIONS FROM DELETEDUSER ARCHIVES (FOR RE-REGISTERING USERS) ───
  const deletedRecords = await prisma.deletedUser.findMany({
    where: {
      phone: { in: variants },
    },
    orderBy: { deletedAt: 'desc' },
  });

  for (const record of deletedRecords) {
    const meta = (record.metadata as any) || {};
    const unlinkedList: Array<{
      relationId: string;
      stubUserId: string;
      treeOwnerId: string;
      relationTypeCode?: string;
    }> = Array.isArray(meta.unlinkedRelations) ? meta.unlinkedRelations : [];

    for (const item of unlinkedList) {
      if (!item.relationId) continue;

      const rel = await prisma.relation.findUnique({
        where: { id: item.relationId },
      });

      if (!rel) continue;

      // Reconnect relation to registered user with PENDING status
      await prisma.relation.update({
        where: { id: rel.id },
        data: {
          toUserId: userId,
          status: 'PENDING',
          approvedAt: null,
        },
      });

      // Update any sub-relations in the other tree that branched from the stub
      if (item.stubUserId) {
        await prisma.relation.updateMany({
          where: { fromUserId: item.stubUserId, createdById: item.treeOwnerId },
          data: { fromUserId: userId },
        });

        // Clean up the stub user if no longer used
        const remainingUsage = await prisma.relation.count({
          where: {
            OR: [{ toUserId: item.stubUserId }, { fromUserId: item.stubUserId }],
          },
        });
        if (remainingUsage === 0 && item.stubUserId !== userId) {
          await prisma.user.delete({ where: { id: item.stubUserId } }).catch(() => {});
        }
      }

      await TreeCacheService.invalidateUserTree(item.treeOwnerId, userId);
      processedCount++;
    }

    // Fallback for archives where unlinkedRelations was empty or relations point to orphan stubs created for this user
    const targetFirstName = record.firstName || user.firstName;
    const targetLastName = record.lastName || user.lastName;
    if (targetFirstName) {
      const orphanStubs = await prisma.user.findMany({
        where: {
          id: { not: userId },
          profileCompleted: false,
          isRegistered: false,
          phone: null,
          firstName: { contains: targetFirstName, mode: 'insensitive' },
          ...(targetLastName ? { lastName: { contains: targetLastName, mode: 'insensitive' } } : {}),
        },
      });

      for (const stub of orphanStubs) {
        const stubRelations = await prisma.relation.findMany({
          where: { toUserId: stub.id },
        });

        for (const sRel of stubRelations) {
          await prisma.relation.update({
            where: { id: sRel.id },
            data: {
              toUserId: userId,
              status: 'PENDING',
              approvedAt: null,
            },
          });

          if (sRel.createdById) {
            await prisma.relation.updateMany({
              where: { fromUserId: stub.id, createdById: sRel.createdById },
              data: { fromUserId: userId },
            });
            await TreeCacheService.invalidateUserTree(sRel.createdById, userId);
          }
          processedCount++;
        }

        // Clean up orphan stub user
        await prisma.notification.deleteMany({ where: { userId: stub.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: stub.id } }).catch(() => {});
      }
    }

    // Mark archive record as reclaimed
    await prisma.deletedUser.update({
      where: { id: record.id },
      data: {
        metadata: {
          ...meta,
          reclaimed: true,
          reclaimedAt: new Date().toISOString(),
          reclaimedBy: userId,
        },
      },
    }).catch(() => {});
  }

  // ─── 3. DISPATCH NOTIFICATIONS FOR ALL PENDING RELATIONS POINTING TO THIS USER ───
  const pendingRelations = await prisma.relation.findMany({
    where: {
      toUserId: userId,
      status: 'PENDING',
      OR: [
        { createdById: null },
        { createdById: { not: userId } },
      ],
    },
    include: {
      relationType: { include: { translations: true } },
      fromUser: { select: { id: true, firstName: true, lastName: true, isAlive: true, phone: true } },
      User_Relation_createdByIdToUser: { select: { id: true, firstName: true, lastName: true, isAlive: true, phone: true } },
    },
  });

  for (const rel of pendingRelations) {
    const creator = rel.User_Relation_createdByIdToUser || rel.fromUser;
    if (!creator || creator.id === userId) continue;
    if (creator.isAlive === false) continue;

    const creatorName = creator.firstName
      ? `${creator.firstName}${creator.lastName ? ' ' + creator.lastName : ''}`
      : 'A family member';
    const label = resolveLabel(rel.relationType, user.appLanguage || 'mr');
    const title = 'New relation request';
    const message = `${creatorName} has added you as ${label} to their family tree. Please approve to connect.`;

    const existingNotif = await prisma.notification.findFirst({
      where: {
        userId,
        relationId: rel.id,
        type: 'RELATION_REQUEST',
      },
    });

    if (!existingNotif) {
      // Create new in-app and push notification
      await createNotification({
        userId,
        type: 'RELATION_REQUEST',
        title,
        message,
        relationId: rel.id,
      });
      processedCount++;
    }

    // ── Notify the creator that the relative has now registered on Samajunnati ──
    const registeredPersonName = user.firstName
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : 'Your relative';
    const creatorTitle = `${registeredPersonName} joined Samajunnati`;
    const creatorMessage = `${registeredPersonName} is now on Samajunnati! Your connection request has been sent for their approval.`;

    const existingCreatorNotif = await prisma.notification.findFirst({
      where: {
        userId: creator.id,
        relationId: rel.id,
        type: 'RELATION_REQUEST',
      },
    });

    if (!existingCreatorNotif) {
      await createNotification({
        userId: creator.id,
        type: 'RELATION_REQUEST',
        title: creatorTitle,
        message: creatorMessage,
        relationId: rel.id,
      });
      emitToUser(creator.id, 'tree:update', { userId: creator.id, relationId: rel.id });
      await TreeCacheService.invalidateUserTree(creator.id, userId);
    }
  }

  log.info({ userId, processedCount }, 'Completed syncing pending relations and notifications for user');
  return processedCount;
}

/**
 * Backward compatibility alias for reconnectDeletedUserRelations
 */
export async function reconnectDeletedUserRelations(userId: string, phone: string): Promise<number> {
  return syncPendingRelationsForUser(userId, phone);
}
