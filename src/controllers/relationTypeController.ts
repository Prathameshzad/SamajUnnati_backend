// src/controllers/relationTypeController.ts
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { 
  RELATION_AXIS_CONFIG, 
  SPOUSE_PAIRS, 
  COUSIN_CODES, 
  COUSIN_PARENT_MAP 
} from '../utils/relationMetadata';

export const listRelationTypes = async (req: Request, res: Response) => {
  const { gender, category } = req.query;
  const lang = (req.query.lang as string) || 'mr';

  try {
    const where: any = {};
    if (gender) where.targetGender = { in: [gender, null] };
    if (category) where.category = category;

    const types = await prisma.relationType.findMany({
      where,
      include: {
        translations: true,
      },
    });

    const response = types.map(t => {
      const trans = t.translations.find(tr => tr.languageCode === lang) || t.translations[0];
      return {
        code: t.code,
        label: trans ? trans.label : t.code,
        targetGender: t.targetGender,
        treeLevel: t.treeLevel,
        reciprocalCode: t.reciprocalCode,
        category: t.category,
      };
    });

    return res.json(response);
  } catch (error) {
    console.error('listRelationTypes error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRelationConfig = async (req: Request, res: Response) => {
  const lang = (req.query.lang as string) || 'mr';

  try {
    // 1. Fetch all relation types and translations from DB to build 'metadata'
    const allTypes = await prisma.relationType.findMany({
      include: { translations: true }
    });

    const metadata: Record<string, any> = {};
    allTypes.forEach(t => {
      const trans = t.translations.find(tr => tr.languageCode === lang) || t.translations[0];
      metadata[t.code] = {
        code: t.code,
        label: trans ? trans.label : t.code,
        gender: t.targetGender,
        level: t.treeLevel ?? 0,
        vg: (t.treeLevel ?? 0) > 0 ? 'UP' : (t.treeLevel ?? 0) < 0 ? 'DOWN' : 'SAME',
        reciprocalCode: t.reciprocalCode,
        category: t.category,
      };
    });

    // 2. Combine with static behavior/config from utils
    return res.json({
      metadata,
      axisConfig: RELATION_AXIS_CONFIG,
      spousePairs: SPOUSE_PAIRS,
      cousinCodes: COUSIN_CODES,
      cousinParentMap: COUSIN_PARENT_MAP,
    });
  } catch (error) {
    console.error('getRelationConfig error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
