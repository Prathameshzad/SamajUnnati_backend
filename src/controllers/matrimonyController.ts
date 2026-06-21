import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { FamilyGraphMatchEngine } from '../services/matrimonyEngine';

export class MatrimonyController {
  
  async upsertProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = req.body;

      const profile = await prisma.matrimonyProfile.upsert({
        where: { userId },
        update: { ...data },
        create: { ...data, userId },
      });

      FamilyGraphMatchEngine.generateRecommendations(userId).catch(e => console.error("Error generating recommendations:", e));
      return res.json({ status: 'success', data: profile });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

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
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  /**
   * Parent creates a matrimony profile for a family member (child/sibling).
   * If the child already has an account (matched by phone), we attach to that user.
   * Otherwise we create a lightweight placeholder User for the child.
   */
  async upsertProfileForChild(req: Request, res: Response) {
    try {
      const parentUserId = (req as any).user.id;
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
      FamilyGraphMatchEngine.generateRecommendations(childUser.id).catch(e =>
        console.error("Error generating recommendations for child:", e)
      );

      return res.json({ status: 'success', alreadyExists: false, data: childProfile });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  /** Returns all profiles the logged-in user manages */
  async getManagedProfiles(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const profiles = await prisma.matrimonyProfile.findMany({
        where: { managedByUserId: userId },
        include: {
          user: true,
          preference: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return res.json({ status: 'success', data: profiles });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  /**
   * Child claims the profile that was created by a parent.
   * After claiming: profileType → SELF, isClaimed → true.
   * managedByUserId is KEPT so parent retains read-only access.
   */
  async claimProfile(req: Request, res: Response) {
    try {
      const claimingUserId = (req as any).user.id;

      const profile = await prisma.matrimonyProfile.findFirst({
        where: {
          userId: claimingUserId,
          profileType: 'MANAGED',
          isClaimed: false,
        },
      });

      if (!profile) {
        return res.status(404).json({
          status: 'error',
          message: 'No claimable profile found for your account.',
        });
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
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async upsertPreference(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
      if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });

      const data = req.body;
      const preference = await prisma.matrimonyPreference.upsert({
        where: { profileId: profile.id },
        update: { ...data },
        create: { ...data, profileId: profile.id },
      });

      FamilyGraphMatchEngine.generateRecommendations(userId).catch(e => console.error("Error generating recommendations:", e));
      return res.json({ status: 'success', data: preference });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getPreference(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const profile = await prisma.matrimonyProfile.findUnique({
        where: { userId },
        include: { preference: true }
      });
      return res.json({ status: 'success', data: profile?.preference || null });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getFeed(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
      if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });

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
          target: { include: { user: true } }
        }
      });

      return res.json({ status: 'success', data: recommendations });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async handleAction(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { targetId, action } = req.body;

      const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
      if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });

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
            const conversation = await prisma.conversation.create({
              data: {
                isGroup: false,
                category: 'MATRIMONY',
                createdById: profile.userId,
                members: {
                  create: [
                    { userId: profile.userId },
                    { userId: targetProfile!.userId }
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
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getMatches(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
      if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });

      const matches = await prisma.matrimonyMatch.findMany({
        where: { OR: [{ userAId: profile.id }, { userBId: profile.id }] },
        include: {
          userA: { include: { user: true } },
          userB: { include: { user: true } },
        }
      });
      return res.json({ status: 'success', data: matches });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getShortlists(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const profile = await prisma.matrimonyProfile.findUnique({ where: { userId } });
      if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });

      const matches = await prisma.matrimonyMatch.findMany({
        where: { OR: [{ userAId: profile.id }, { userBId: profile.id }] },
      });
      const matchedIds = matches.map((m: any) => m.userAId === profile.id ? m.userBId : m.userAId);

      const sentShortlists = await prisma.matrimonyShortlist.findMany({
        where: { userId: profile.id, targetId: { notIn: matchedIds } },
        include: { target: { include: { user: true } } },
        orderBy: { createdAt: 'desc' }
      });

      const receivedShortlists = await prisma.matrimonyShortlist.findMany({
        where: { targetId: profile.id, userId: { notIn: matchedIds } },
        include: { user: { include: { user: true } } },
        orderBy: { createdAt: 'desc' }
      });

      const combined = [
        ...sentShortlists.map((s: any) => ({ ...s, type: 'SENT', profile: s.target })),
        ...receivedShortlists.map((r: any) => ({ ...r, type: 'RECEIVED', profile: r.user }))
      ];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({ status: 'success', data: combined });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }
}
