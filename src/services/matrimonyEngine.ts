import { MatrimonyProfile, MatrimonyPreference } from '@prisma/client';
import prisma from '../lib/prisma';
import { FamilyGraphTraversalService } from './matrimonyGraphService';

export class TrustScoreEngine {
  /**
   * Shorter distance = higher trust score.
   * Weight = 60% of overall score
   * e.g. Distance 1 = 100%, Distance 2 = 90%, etc.
   */
  static calculate(distance: number): number {
    if (distance === 0) return 0;
    if (distance === 1) return 100;
    if (distance === 2) return 90;
    if (distance === 3) return 80;
    if (distance === 4) return 70;
    if (distance === 5) return 60;
    if (distance === 6) return 50;
    if (distance === 7) return 40;
    if (distance === 8) return 30;
    if (distance === 9) return 20;
    if (distance >= 10) return 10;
    return 0;
  }
}

export class CompatibilityEngine {
  /**
   * Calculates compatibility score (0-100) based on preferences.
   * Weight breakdown: Age 40%, Height 20%, Education 20%, Community 20%.
   */
  static calculate(
    targetUser: any,
    targetProfile: MatrimonyProfile,
    preference: MatrimonyPreference | null
  ): number {
    if (!preference) return 50; // default if no pref

    let score = 0;

    // Age
    if (targetUser.dateOfBirth) {
      const ageDiffMs = Date.now() - new Date(targetUser.dateOfBirth).getTime();
      const ageDate = new Date(ageDiffMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      
      const min = preference.ageMin || 18;
      const max = preference.ageMax || 60;
      if (age >= min && age <= max) {
        score += 40;
      } else {
        score += 20; // Partial match
      }
    } else {
      score += 20;
    }

    // Height
    if (targetProfile.height && preference.heightMin && preference.heightMax) {
      if (targetProfile.height >= preference.heightMin && targetProfile.height <= preference.heightMax) {
        score += 20;
      }
    } else {
      score += 10;
    }

    // Education
    if (targetProfile.education && preference.education && preference.education.length > 0) {
      if (preference.education.includes(targetProfile.education)) {
        score += 20;
      }
    } else {
      score += 10;
    }

    // Community
    if (targetProfile.community && preference.community && preference.community.length > 0) {
      if (preference.community.includes(targetProfile.community)) {
        score += 20;
      }
    } else {
      score += 10;
    }

    return score;
  }
}

export class FamilyGraphMatchEngine {
  /**
   * Generates recommendations for a user and stores them in the cache.
   * Used mostly as a background task.
   */
  static async generateRecommendations(userId: string) {
    const profile = await prisma.matrimonyProfile.findUnique({
      where: { userId },
      include: { preference: true, user: true },
    });

    if (!profile) return;

    // Get nodes from BFS
    const nodes = await FamilyGraphTraversalService.traverseGraph(userId, 10);

    for (const node of nodes) {
      // Check if target has an active matrimony profile
      const targetProfile = await prisma.matrimonyProfile.findUnique({
        where: { userId: node.userId },
        include: { user: true },
      });

      if (!targetProfile || !targetProfile.isLookingForMarriage) continue;

      // Ensure gender match (opposite gender)
      if (profile.user.gender === targetProfile.user.gender) continue;

      // Check if not already matched, blocked, rejected, etc.
      const existingMatch = await prisma.matrimonyMatch.findFirst({
        where: {
          OR: [
            { userAId: profile.id, userBId: targetProfile.id },
            { userAId: targetProfile.id, userBId: profile.id },
          ],
        },
      });
      if (existingMatch) continue;

      const block = await prisma.matrimonyBlock.findFirst({
        where: { userId: profile.id, targetId: targetProfile.id },
      });
      if (block) continue;

      const reject = await prisma.matrimonyInterest.findFirst({
        where: { senderId: profile.id, receiverId: targetProfile.id, status: 'REJECTED' },
      });
      if (reject) continue;

      // Calculate Scores
      const trustScore = TrustScoreEngine.calculate(node.distance);
      const compScore = CompatibilityEngine.calculate(targetProfile.user, targetProfile, profile.preference);
      
      // Overall Score: 60% Trust + 40% Compatibility (approximated based on requirement)
      const overallScore = (trustScore * 0.6) + (compScore * 0.4);

      const pathString = await FamilyGraphTraversalService.translatePathToReadable(node.path, targetProfile.user.gender);

      // Upsert to cache
      await prisma.graphRecommendationCache.upsert({
        where: {
          userId_targetId: {
            userId: profile.id,
            targetId: targetProfile.id,
          },
        },
        update: {
          distance: node.distance,
          connectionPath: pathString,
          trustScore,
          compatibilityScore: compScore,
          overallScore,
        },
        create: {
          userId: profile.id,
          targetId: targetProfile.id,
          distance: node.distance,
          connectionPath: pathString,
          trustScore,
          compatibilityScore: compScore,
          overallScore,
        },
      });
    }
  }
}
