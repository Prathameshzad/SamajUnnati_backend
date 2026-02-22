// src/controllers/relationTypeController.ts
import { Request, Response } from 'express';
import { RELATION_METADATA } from '../utils/relationMetadata';

type GenderValue = 'MALE' | 'FEMALE' | null;

function normalizeGenderQuery(g?: string | undefined): GenderValue {
  if (!g) return null;
  const u = g.trim().toUpperCase();
  if (u === 'MALE') return 'MALE';
  if (u === 'FEMALE') return 'FEMALE';
  return null;
}

export const listRelationTypes = async (req: Request, res: Response) => {
  const genderQuery = normalizeGenderQuery(req.query.gender as string | undefined);

  try {
    const allTypes = Object.values(RELATION_METADATA);

    // mimic the DB ID for frontend compatibility if needed, or just send codes
    // The previous frontend API expected: id, code, label, targetGender, etc.
    // We'll map it to look similar.

    let filtered = allTypes;
    if (genderQuery) {
      filtered = allTypes.filter(rt => rt.gender === null || rt.gender === genderQuery);
    }

    const response = filtered.map((rt, index) => ({
      id: index + 1, // Artificial ID
      code: rt.code,
      label: rt.label,
      targetGender: rt.gender,
      treeLevel: rt.level,
      verticalGroup: rt.vg,
      reciprocalCode: rt.reciprocalCode || null
    }));

    return res.json(response);
  } catch (error) {
    console.error('listRelationTypes error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
