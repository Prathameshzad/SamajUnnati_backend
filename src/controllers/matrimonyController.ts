// src/controllers/matrimonyController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { FamilyGraphMatchEngine } from '../services/matrimonyEngine';
import { OtpService } from '../services/otpService';
import { AuthRequest } from '../middleware/authMiddleware';
import { badRequest, notFound, rateLimited, unauthenticated } from '../lib/errors';
import { createLogger, maskPhone } from '../lib/logger';

const log = createLogger('matrimony');

/**
 * Card-display field set for the "other person" in a match/feed/shortlist card.
 *
 * The feed, matches and shortlist endpoints used `include: { user: true }` on the
 * target/userA/userB relation, which returns every User column — email, address,
 * pincode, dateOfBirth, bloodGroup, phone, whatsapp — for someone the caller may
 * only just be seeing for the first time. The mobile screens (`(matrimony)/index.tsx`,
 * `(matrimony)/matches.tsx`) only ever read firstName/lastName off that object, so
 * the rest was pure PII overexposure on a feature where the whole point is that
 * contact info is gated behind a mutual match + in-app chat, not the profile card.
 */
const MATRIMONY_CARD_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  gender: true,
} as const;

export class MatrimonyController {

  async upsertProfile(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const data = req.body;

    const profile = await prisma.matrimonyProfile.upsert({
      where: { userId },
      update: { ...data },
      create: { ...data, userId },
    });

    FamilyGraphMatchEngine.generateRecommendations(userId).catch((err) =>
      log.error({ err, userId }, 'failed to generate recommendations')
    );
    return res.json({ status: 'success', data: profile });
  }

  async getProfile(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();

    // Own profile
    const profile = await prisma.matrimonyProfile.findUnique({
      where: { userId },
      include: { preference: true, user: true },
    });

    // Profiles this user manages on behalf of others
    const managedProfiles = await prisma.matrimonyProfile.findMany({
      where: { managedByUserId: userId },
      include: { user: true },
    });

    return res.json({ status: 'success', data: profile, managedProfiles });
  }

  /**
   * Parent creates a matrimony profile for a family member (child/sibling).
   * If the child already has an account (matched by phone), we attach to that user.
   * Otherwise we create a lightweight placeholder User for the child.
   */
  async upsertProfileForChild(req: AuthRequest, res: Response) {
    const parentUserId = req.user?.id;
    if (!parentUserId) throw unauthenticated();
    const {
      childPhone,
      childFirstName,
      childLastName,
      childDOB,
      childGender,
      relationLabel, // 'Son' | 'Daughter' | 'Brother' | 'Sister' | 'Other'
      ...profileData
    } = req.body;

    // Step 1: Find or create the child's User record
    let childUser = childPhone
      ? await prisma.user.findUnique({ where: { phone: childPhone } })
      : null;

    // If child already has their own SELF profile, just return it directly
    if (childUser) {
      const existingOwnProfile = await prisma.matrimonyProfile.findUnique({
        where: { userId: childUser.id },
        include: { preference: true, user: true },
      });
      if (existingOwnProfile && existingOwnProfile.profileType === 'SELF') {
        return res.json({
          status: 'success',
          alreadyExists: true,
          data: existingOwnProfile,
          message: 'This person already has their own profile.',
        });
      }
    }

    if (!childUser) {
      childUser = await prisma.user.create({
        data: {
          phone: childPhone || null,
          firstName: childFirstName,
          lastName: childLastName || null,
          dateOfBirth: childDOB ? new Date(childDOB) : null,
          gender: childGender || null,
          isRegistered: false, // placeholder — becomes true when child claims
        },
      });
    }

    // Step 2: Upsert the child's MatrimonyProfile as MANAGED
    const childProfile = await prisma.matrimonyProfile.upsert({
      where: { userId: childUser.id },
      update: {
        ...profileData,
        profileType: 'MANAGED',
        relationLabel,
        managedByUserId: parentUserId,
        isClaimed: false,
      },
      create: {
        ...profileData,
        userId: childUser.id,
        profileType: 'MANAGED',
        relationLabel,
        managedByUserId: parentUserId,
        isClaimed: false,
      },
    });

    // Step 3: Trigger recommendations for the child's profile
    FamilyGraphMatchEngine.generateRecommendations(childUser.id).catch((err) =>
      log.error({ err, userId: childUser!.id }, 'failed to generate recommendations for child')
    );

    return res.json({ status: 'success', alreadyExists: false, data: childProfile });
  }

  /** Returns all profiles the logged-in user manages */
  async getManagedProfiles(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const profiles = await prisma.matrimonyProfile.findMany({
      where: { managedByUserId: userId },
      include: {
        user: true,
        preference: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ status: 'success', data: profiles });
  }

  /**
   * Child claims the profile that was created by a parent.
   * After claiming: profileType → SELF, isClaimed → true.
   * managedByUserId is KEPT so parent retains read-only access.
   */
  async claimProfile(req: AuthRequest, res: Response) {
    const claimingUserId = req.user?.id;
    if (!claimingUserId) throw unauthenticated();

    const profile = await prisma.matrimonyProfile.findFirst({
      where: {
        userId: claimingUserId,
        profileType: 'MANAGED',
        isClaimed: false,
      },
    });

    if (!profile) {
      throw notFound('No claimable profile found for your account.');
    }

    const claimed = await prisma.matrimonyProfile.update({
      where: { id: profile.id },
      data: {
        profileType: 'SELF',
        isClaimed: true,
        // managedByUserId is kept for parent's read-only access
      },
    });

    await prisma.user.update({
      where: { id: claimingUserId },
      data: { isRegistered: true },
    });

    return res.json({ status: 'success', data: claimed });
  }

  async upsertPreference(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
    if (!profile) throw notFound('Profile not found');

    const data = req.body;
    const preference = await prisma.matrimonyPreference.upsert({
      where: { profileId: profile.id },
      update: { ...data },
      create: { ...data, profileId: profile.id },
    });

    FamilyGraphMatchEngine.generateRecommendations(userId).catch((err) =>
      log.error({ err, userId }, 'failed to generate recommendations')
    );
    return res.json({ status: 'success', data: preference });
  }

  async getPreference(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const profile = await prisma.matrimonyProfile.findUnique({
      where: { userId },
      include: { preference: true }
    });
    return res.json({ status: 'success', data: profile?.preference || null });
  }

  async getFeed(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
    if (!profile) throw notFound('Profile not found');

    const recommendations = await prisma.graphRecommendationCache.findMany({
      where: {
        userId: profile.id,
        target: {
          interestsReceived: {
            none: { senderId: profile.id }
          }
        }
      },
      orderBy: { overallScore: 'desc' },
      take: 20,
      include: {
        // Narrowed from `include: { user: true }` — see MATRIMONY_CARD_USER_SELECT.
        target: { include: { user: { select: MATRIMONY_CARD_USER_SELECT } } }
      }
    });

    return res.json({ status: 'success', data: recommendations });
  }

  async handleAction(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const { targetId, action } = req.body;

    const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
    if (!profile) throw notFound('Profile not found');

    if (action === 'SHORTLIST') {
      const shortlist = await prisma.matrimonyShortlist.upsert({
        where: { userId_targetId: { userId: profile.id, targetId } },
        update: {},
        create: { userId: profile.id, targetId }
      });
      return res.json({ status: 'success', data: shortlist });
    }

    const interestStatus = action === 'INTERESTED' ? 'INTERESTED' : 'REJECTED';
    const interest = await prisma.matrimonyInterest.upsert({
      where: { senderId_receiverId: { senderId: profile.id, receiverId: targetId } },
      update: { status: interestStatus },
      create: { senderId: profile.id, receiverId: targetId, status: interestStatus }
    });

    if (interestStatus === 'INTERESTED') {
      const reciprocal = await prisma.matrimonyInterest.findUnique({
        where: { senderId_receiverId: { senderId: targetId, receiverId: profile.id } }
      });

      if (reciprocal && reciprocal.status === 'INTERESTED') {
        const existingMatch = await prisma.matrimonyMatch.findFirst({
          where: {
            OR: [
              { userAId: profile.id, userBId: targetId },
              { userAId: targetId, userBId: profile.id },
            ],
          },
        });

        if (!existingMatch) {
          const targetProfile = await prisma.matrimonyProfile.findUnique({ where: { id: targetId } });
          // Defensive: previously this was a non-null assertion (`targetProfile!.userId`)
          // that would throw an uncaught TypeError for a stale/invalid targetId instead
          // of a clean 404. Behavior for a valid targetId is unchanged.
          if (!targetProfile) throw notFound('Target profile not found');

          const conversation = await prisma.conversation.create({
            data: {
              isGroup: false,
              category: 'MATRIMONY',
              createdById: profile.userId,
              members: {
                create: [
                  { userId: profile.userId },
                  { userId: targetProfile.userId }
                ]
              }
            }
          });
          const match = await prisma.matrimonyMatch.create({
            data: { userAId: profile.id, userBId: targetId, conversationId: conversation.id }
          });
          return res.json({ status: 'success', match, isMatch: true, conversationId: conversation.id });
        }
      }
    }

    return res.json({ status: 'success', data: interest, isMatch: false });
  }

  async getMatches(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
    if (!profile) throw notFound('Profile not found');

    const matches = await prisma.matrimonyMatch.findMany({
      where: { OR: [{ userAId: profile.id }, { userBId: profile.id }] },
      include: {
        // Narrowed from `include: { user: true }` — see MATRIMONY_CARD_USER_SELECT.
        userA: { include: { user: { select: MATRIMONY_CARD_USER_SELECT } } },
        userB: { include: { user: { select: MATRIMONY_CARD_USER_SELECT } } },
      }
    });
    return res.json({ status: 'success', data: matches });
  }

  async getShortlists(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
    if (!profile) throw notFound('Profile not found');

    const matches = await prisma.matrimonyMatch.findMany({
      where: { OR: [{ userAId: profile.id }, { userBId: profile.id }] },
    });
    const matchedIds = matches.map((m: any) => m.userAId === profile.id ? m.userBId : m.userAId);

    const sentShortlists = await prisma.matrimonyShortlist.findMany({
      where: { userId: profile.id, targetId: { notIn: matchedIds } },
      // Narrowed from `include: { user: true }` — see MATRIMONY_CARD_USER_SELECT.
      include: { target: { include: { user: { select: MATRIMONY_CARD_USER_SELECT } } } },
      orderBy: { createdAt: 'desc' }
    });

    const receivedShortlists = await prisma.matrimonyShortlist.findMany({
      where: { targetId: profile.id, userId: { notIn: matchedIds } },
      include: { user: { include: { user: { select: MATRIMONY_CARD_USER_SELECT } } } },
      orderBy: { createdAt: 'desc' }
    });

    const combined = [
      ...sentShortlists.map((s: any) => ({ ...s, type: 'SENT', profile: s.target })),
      ...receivedShortlists.map((r: any) => ({ ...r, type: 'RECEIVED', profile: r.user }))
    ];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ status: 'success', data: combined });
  }

  // --- Advanced Flow for Managed Profiles ---

  private normalizePhone(phone: string | undefined | null) {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10 ? clean.slice(-10) : null;
  }

  async checkPhoneForManagedProfile(req: AuthRequest, res: Response) {
    const { phone } = req.body;
    const normalized = this.normalizePhone(phone);
    if (!normalized) throw badRequest('Invalid phone number');

    const childUser = await prisma.user.findUnique({
      where: { phone: normalized },
      include: { matrimonyProfile: true }
    });

    if (!childUser) {
      /**
       * SECURITY FIX: this branch used to just report `exists: false` with no
       * OTP ever sent, while `verifyOtpAndCreateUser` accepted a hardcoded
       * '1234' as a valid code for any phone number — a universal bypass, same
       * class of bug as the '1111' bypass already removed from OtpService.
       * This now issues a real OTP through the same service auth uses, so the
       * subsequent verify step has something genuine to check against.
       */
      const otpResult = await OtpService.sendOtp(normalized, 'REGISTER');
      if (otpResult.rateLimited) {
        throw rateLimited(otpResult.message, { retryAfterSeconds: otpResult.retryAfterSeconds });
      }
      return res.json({
        status: 'success',
        exists: false,
        ...(otpResult.code ? { code: otpResult.code } : {}),
      });
    }

    const hasSelfProfile = childUser.matrimonyProfile?.profileType === 'SELF';
    const isManaged = childUser.matrimonyProfile?.profileType === 'MANAGED';

    return res.json({
      status: 'success',
      exists: true,
      user: {
        id: childUser.id,
        firstName: childUser.firstName,
        lastName: childUser.lastName,
        gender: childUser.gender,
      },
      hasSelfProfile,
      isManaged,
      managedById: childUser.matrimonyProfile?.managedByUserId
    });
  }

  async requestManagedProfileApproval(req: AuthRequest, res: Response) {
    const parentUserId = req.user?.id;
    if (!parentUserId) throw unauthenticated();
    const { targetUserId, relationLabel } = req.body;

    // Ensure the target is actually registered and does not have a SELF profile yet?
    // For now, just create a relation request of type MATRIMONY_MANAGER

    const parent = await prisma.user.findUnique({ where: { id: parentUserId } });

    const existing = await prisma.relation.findFirst({
      where: {
        fromUserId: parentUserId,
        toUserId: targetUserId,
        relationTypeCode: 'MATRIMONY_MANAGER',
        category: 'MATRIMONY'
      }
    });
    if (existing) {
      throw badRequest('Approval request already sent');
    }

    const relation = await prisma.relation.create({
      data: {
        fromUserId: parentUserId,
        toUserId: targetUserId,
        relationTypeCode: 'MATRIMONY_MANAGER',
        category: 'MATRIMONY',
        status: 'PENDING',
        customName: relationLabel
      }
    });

    // Send Notification to the target
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'MATRIMONY_PROFILE_APPROVAL',
        title: 'Matrimony Profile Management',
        message: `${parent?.firstName || 'Someone'} wants to create and manage a Matrimony Profile for you.`,
        relationId: relation.id
      }
    });

    return res.json({ status: 'success', message: 'Approval request sent to the user' });
  }

  async verifyOtpAndCreateUser(req: AuthRequest, res: Response) {
    const parentUserId = req.user?.id;
    if (!parentUserId) throw unauthenticated();
    const { phone, otp, firstName, lastName, gender, relationLabel } = req.body;

    const normalized = this.normalizePhone(phone);
    if (!normalized) throw badRequest('Invalid phone number');

    /**
     * SECURITY FIX: this was `if (otp !== '1234') return 400` — a hardcoded
     * universal OTP bypass, active in production, for creating and linking a
     * user record. Replaced with the same OtpService.verifyOtp used by the main
     * auth flow (single-use, attempt-limited, constant-time compare).
     */
    const isValid = await OtpService.verifyOtp(normalized, otp);
    if (!isValid) {
      log.warn({ phone: maskPhone(normalized) }, 'managed profile otp verification failed');
      throw badRequest('Invalid OTP');
    }

    // Create User
    let childUser = await prisma.user.create({
      data: {
        phone: normalized,
        firstName,
        lastName,
        gender: gender || null,
        isRegistered: false,
      }
    });

    // Create a confirmed relation indicating parent manages them
    await prisma.relation.create({
      data: {
        fromUserId: parentUserId,
        toUserId: childUser.id,
        relationTypeCode: 'MATRIMONY_MANAGER',
        category: 'MATRIMONY',
        status: 'CONFIRMED',
        customName: relationLabel
      }
    });

    log.info({ phone: maskPhone(normalized), parentUserId }, 'managed profile child user created');

    return res.json({ status: 'success', user: childUser });
  }
}
