// src/controllers/matrimonyController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { FamilyGraphMatchEngine } from '../services/matrimonyEngine';
import { createNotification } from '../services/notificationService';
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
      return res.json({
        status: 'success',
        exists: false,
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

  /**
   * `Relation.relationTypeCode` is a foreign key, and this type is not part of the
   * seeded family/friend taxonomy, so without this every create fails with
   * "Referenced record does not exist". It has no tree level, so it never appears
   * in the tree's add-relative options.
   */
  private async ensureManagerRelationType() {
    await prisma.relationType.upsert({
      where: { code: 'MATRIMONY_MANAGER' },
      update: {},
      create: { code: 'MATRIMONY_MANAGER', category: 'MATRIMONY' },
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

    await this.ensureManagerRelationType();

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

    // Send Notification to the target. Goes to the lock screen too: this is an
    // approval request that blocks the requester until the target acts on it.
    await createNotification({
      userId: targetUserId,
      type: 'MATRIMONY_PROFILE_APPROVAL',
      title: 'Matrimony Profile Management',
      message: `${parent?.firstName || 'Someone'} wants to create and manage a Matrimony Profile for you.`,
      relationId: relation.id,
    });

    return res.json({ status: 'success', message: 'Approval request sent to the user' });
  }

  async verifyOtpAndCreateUser(req: AuthRequest, res: Response) {
    const parentUserId = req.user?.id;
    if (!parentUserId) throw unauthenticated();
    const { phone, firstName, lastName, gender, relationLabel } = req.body;

    const normalized = this.normalizePhone(phone);
    if (!normalized) throw badRequest('Invalid phone number');

    if (!firstName || !String(firstName).trim()) {
      throw badRequest('First name is required');
    }

    // Check if user already exists
    let childUser = await prisma.user.findUnique({
      where: { phone: normalized },
    });

    const normalizedGender = String(gender ?? '').toUpperCase();

    if (!childUser) {
      // Create User as placeholder
      childUser = await prisma.user.create({
        data: {
          phone: normalized,
          firstName: String(firstName).trim(),
          lastName: lastName ? String(lastName).trim() : null,
          // Clients send display values ('Male', 'Other'). The enum only has MALE and
          // FEMALE, and anything else used to fail the create with a 500.
          gender: normalizedGender === 'MALE' || normalizedGender === 'FEMALE' ? normalizedGender : null,
          isRegistered: false,
        }
      });
    }

    // Check if relation already exists
    const existingRelation = await prisma.relation.findFirst({
      where: {
        fromUserId: parentUserId,
        toUserId: childUser.id,
        relationTypeCode: 'MATRIMONY_MANAGER',
      }
    });

    if (!existingRelation) {
      await this.ensureManagerRelationType();
      // Create a confirmed relation indicating parent manages them
      await prisma.relation.create({
        data: {
          fromUserId: parentUserId,
          toUserId: childUser.id,
          relationTypeCode: 'MATRIMONY_MANAGER',
          category: 'MATRIMONY',
          status: 'CONFIRMED',
          customName: relationLabel || null,
        }
      });
    }

    log.info({ phone: maskPhone(normalized), parentUserId }, 'managed profile child user created');

    return res.json({ status: 'success', user: childUser });
  }

  /* ── Quick registration + waitlist ─────────────────────────────────────── */

  /**
   * GET /api/matrimony/status
   *
   * Tells the app where to send the user: the registration form (with
   * everything we already know about them pre-filled) or the waitlist screen.
   */
  async getStatus(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        photoUrl: true,
        gender: true,
        dateOfBirth: true,
        maritalStatus: true,
        religion: true,
        caste: true,
        community: true,
        education: true,
        occupation: true,
        matrimonyProfile: {
          select: { status: true, waitlistedAt: true, registrationCompletedAt: true },
        },
      },
    });
    if (!user) throw notFound('User not found');

    const mp = user.matrimonyProfile;
    const registered = !!mp?.registrationCompletedAt;
    const waitlist = registered && mp?.status === 'WAITLIST' ? await waitlistInfo(mp.waitlistedAt) : null;

    return res.json({
      status: 'success',
      data: {
        registered,
        profileStatus: registered ? mp!.status : null,
        waitlist,
        prefill: {
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
          maritalStatus: user.maritalStatus,
          religion: user.religion,
          caste: user.caste,
          community: user.community,
          education: user.education,
          occupation: user.occupation,
        },
      },
    });
  }

  /**
   * POST /api/matrimony/register  (body validated by matrimonyRegisterSchema)
   *
   * Saves the whole quick-registration form in one transaction, writes the core
   * facts back to the user's main profile, and puts them on the waitlist.
   */
  async register(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw unauthenticated();
    const b = req.body as {
      gender?: 'MALE' | 'FEMALE';
      dateOfBirth?: string;
      maritalStatus: string;
      religion?: string;
      caste?: string;
      community?: string;
      motherTongue?: string;
      birthState: string;
      birthCity: string;
      birthTaluka?: string;
      birthDistrict?: string;
      birthPlaceId?: string;
      birthLat?: number;
      birthLng?: number;
      birthTime?: string;
      birthTimeUnknown: boolean;
      height: number;
      education: string;
      occupation: string;
      income?: string;
      diet?: string;
      drinking?: string;
      smoking?: string;
      familyType?: string;
      marriageTimeline?: string;
      hobbies: string[];
      vibes: string[];
      bio?: string;
      photos: string[];
      partnerAgeMin: number;
      partnerAgeMax: number;
      partnerReligion: 'SAME' | 'ANY';
    };

    // Gender / DOB / religion come from signup unless the client had to ask.
    const stored = await prisma.user.findUnique({
      where: { id: userId },
      select: { gender: true, dateOfBirth: true, religion: true },
    });
    if (!stored) throw notFound('User not found');

    const gender = b.gender ?? (stored.gender === 'MALE' || stored.gender === 'FEMALE' ? stored.gender : null);
    if (!gender) throw badRequest('Please add your gender to continue');

    const dob = b.dateOfBirth ? new Date(`${b.dateOfBirth}T00:00:00.000Z`) : stored.dateOfBirth;
    if (!dob || Number.isNaN(dob.getTime())) throw badRequest('Please add your date of birth to continue');

    const religion = b.religion ?? stored.religion ?? null;

    // Legal minimum marriage age in India: 21 for men, 18 for women.
    const age = ageOn(dob, new Date());
    const minAge = gender === 'MALE' ? 21 : 18;
    if (age < minAge) throw badRequest(`You must be at least ${minAge} to register for matrimony`);
    if (age > 100) throw badRequest('Invalid date of birth');

    const profileFields = {
      photos: b.photos,
      height: b.height,
      maritalStatus: b.maritalStatus,
      religion,
      caste: b.caste ?? null,
      community: b.community ?? b.caste ?? null,
      motherTongue: b.motherTongue ?? null,
      birthState: b.birthState,
      birthCity: b.birthCity,
      birthTaluka: b.birthTaluka ?? null,
      birthDistrict: b.birthDistrict ?? null,
      birthPlaceId: b.birthPlaceId ?? null,
      birthLat: b.birthLat ?? null,
      birthLng: b.birthLng ?? null,
      birthPlace: [b.birthCity, b.birthTaluka, b.birthState].filter(Boolean).join(', '),
      birthTime: b.birthTimeUnknown ? null : b.birthTime ?? null,
      birthTimeUnknown: b.birthTimeUnknown,
      education: b.education,
      occupation: b.occupation,
      income: b.income ?? null,
      diet: b.diet ?? null,
      drinking: b.drinking ?? null,
      smoking: b.smoking ?? null,
      familyType: b.familyType ?? null,
      marriageTimeline: b.marriageTimeline ?? null,
      hobbies: b.hobbies,
      vibes: b.vibes,
      bio: b.bio ?? null,
      isLookingForMarriage: true,
    };

    const profile = await prisma.$transaction(async (tx) => {
      // Keep the main profile in sync with what they just confirmed.
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(b.gender ? { gender: b.gender } : {}),
          ...(b.dateOfBirth
            ? { dateOfBirth: dob, birthDay: dob.getUTCDate(), birthMonth: dob.getUTCMonth() + 1 }
            : {}),
          maritalStatus: b.maritalStatus,
          ...(b.religion ? { religion: b.religion } : {}),
          ...(b.caste ? { caste: b.caste } : {}),
          education: b.education,
          occupation: b.occupation,
        },
      });

      const existing = await tx.matrimonyProfile.findUnique({
        where: { userId },
        select: { registrationCompletedAt: true },
      });

      const saved = await tx.matrimonyProfile.upsert({
        where: { userId },
        create: {
          ...profileFields,
          userId,
          profileType: 'SELF',
          status: 'WAITLIST',
          waitlistedAt: new Date(),
          registrationCompletedAt: new Date(),
        },
        update: {
          ...profileFields,
          // Editing an existing registration must not reset the queue position.
          ...(existing?.registrationCompletedAt ? {} : { registrationCompletedAt: new Date(), waitlistedAt: new Date() }),
        },
      });

      const prefData = {
        ageMin: b.partnerAgeMin,
        ageMax: b.partnerAgeMax,
        religion: b.partnerReligion === 'SAME' && religion ? [religion] : [],
      };
      await tx.matrimonyPreference.upsert({
        where: { profileId: saved.id },
        create: { ...prefData, profileId: saved.id },
        update: prefData,
      });

      return saved;
    });

    log.info({ userId }, 'matrimony quick registration completed');

    const waitlist = profile.status === 'WAITLIST' ? await waitlistInfo(profile.waitlistedAt) : null;
    return res.json({
      status: 'success',
      data: { registered: true, profileStatus: profile.status, waitlist },
    });
  }
}

/** Age in whole years on `at`. */
function ageOn(dob: Date, at: Date): number {
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const m = at.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** 1-based queue position and total size of the matrimony waitlist. */
async function waitlistInfo(waitlistedAt: Date) {
  const [ahead, total] = await Promise.all([
    prisma.matrimonyProfile.count({
      where: { status: 'WAITLIST', registrationCompletedAt: { not: null }, waitlistedAt: { lt: waitlistedAt } },
    }),
    prisma.matrimonyProfile.count({
      where: { status: 'WAITLIST', registrationCompletedAt: { not: null } },
    }),
  ]);
  return { position: ahead + 1, total, joinedAt: waitlistedAt.toISOString() };
}
