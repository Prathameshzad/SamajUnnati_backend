// src/routes/relationTypeRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { listRelationTypes, getRelationConfig } from '../controllers/relationTypeController';

const router = Router();

// GET /api/relation-types/config
router.get('/config', authMiddleware, getRelationConfig);

// GET /api/relation-types?gender=MALE | FEMALE
router.get('/', authMiddleware, listRelationTypes);

export default router;
