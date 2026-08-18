import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  getFriendTree,
  listFriends,
  createFriend,
  getFriendRequests,
  approveFriend,
  rejectFriend,
  deleteFriend,
} from '../controllers/friendController';

const router = Router();

router.get('/tree/full', authMiddleware, getFriendTree);
router.get('/requests', authMiddleware, getFriendRequests);   // pending incoming friend requests
router.get('/', authMiddleware, listFriends);
router.post('/', authMiddleware, createFriend);
router.post('/:id/approve', authMiddleware, approveFriend);  // approve a friend request
router.post('/:id/reject', authMiddleware, rejectFriend);    // reject a friend request
router.delete('/:id', authMiddleware, deleteFriend);         // remove a friend

export default router;

