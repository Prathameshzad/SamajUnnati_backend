// src/routes/relationTypeRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { listRelationTypes } from '../controllers/relationTypeController';

const router = Router();

// GET /api/relation-types?gender=MALE | FEMALE
router.get('/', authMiddleware, listRelationTypes);

export default router;
