// src/routes/relationRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  listRelations,
  getTree,
  getRequests,
  createRelation,
  approveRelation,
  rejectRelation,
  updateRelation,
  deleteRelation,
  getFullTree,
  getRelationCounts,
} from '../controllers/relationController';

const router = Router();

router.get('/counts', authMiddleware, getRelationCounts); // ⬅️ must be before /:id routes
router.get('/', authMiddleware, listRelations);
router.get('/tree', authMiddleware, getTree);
router.get('/tree/full', authMiddleware, getFullTree);
router.get('/requests', authMiddleware, getRequests);
router.post('/', authMiddleware, createRelation);
router.post('/:id/approve', authMiddleware, approveRelation);
router.post('/:id/reject', authMiddleware, rejectRelation);
router.patch('/:id', authMiddleware, updateRelation);
router.delete('/:id', authMiddleware, deleteRelation);

export default router;
