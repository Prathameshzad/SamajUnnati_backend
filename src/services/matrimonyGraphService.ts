import prisma from '../lib/prisma';

export interface GraphNode {
  userId: string;
  distance: number;
  path: string[];
}

export class FamilyGraphTraversalService {
  /**
   * Traverses the relationship graph up to maxDepth and returns all connected users.
   * Excludes the startUserId from the results.
   * Path format: Array of user IDs.
   */
  static async traverseGraph(startUserId: string, maxDepth: number = 10): Promise<GraphNode[]> {
    const queue: GraphNode[] = [{ userId: startUserId, distance: 0, path: [startUserId] }];
    const visited = new Set<string>();
    visited.add(startUserId);

    const results: GraphNode[] = [];

    // Pre-fetch all confirmed relations for performance
    // In a massive DB this should be optimized or paginated, but for now we fetch incrementally per level
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      if (current.distance > 0) {
        results.push(current);
      }

      if (current.distance >= maxDepth) {
        continue;
      }

      const relations = await prisma.relation.findMany({
        where: {
          OR: [
            { fromUserId: current.userId },
            { toUserId: current.userId },
          ],
          status: 'CONFIRMED',
        },
        include: {
          relationType: true,
        },
      });

      for (const rel of relations) {
        const neighborId = rel.fromUserId === current.userId ? rel.toUserId : rel.fromUserId;

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({
            userId: neighborId,
            distance: current.distance + 1,
            path: [...current.path, neighborId],
          });
        }
      }
    }

    return results;
  }

  /**
   * Translates a path of user IDs into a human-readable string based on relationship names.
   * e.g., "Father -> Mama -> Kaka"
   */
  static async translatePathToReadable(pathIds: string[], targetGender: string | null): Promise<string> {
    if (pathIds.length <= 1) return 'Direct';

    const parts: string[] = [];
    parts.push('You');

    for (let i = 0; i < pathIds.length - 1; i++) {
      const fromId = pathIds[i];
      const toId = pathIds[i + 1];

      // Find the relation between fromId and toId
      const relation = await prisma.relation.findFirst({
        where: {
          OR: [
            { fromUserId: fromId, toUserId: toId },
            { fromUserId: toId, toUserId: fromId },
          ],
          status: 'CONFIRMED',
        },
        include: {
          relationType: true,
        },
      });

      if (relation) {
        // Just use the relationType code or customName
        const relName = relation.customName || relation.relationTypeCode;
        parts.push(relName);
      } else {
        parts.push('Relative');
      }
    }

    return parts.join(' -> ');
  }
}
