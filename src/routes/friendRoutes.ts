import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getFriendTree, listFriends, createFriend } from '../controllers/friendController';

const router = Router();

router.get('/tree/full', authMiddleware, getFriendTree);
router.get('/', authMiddleware, listFriends);
router.post('/', authMiddleware, createFriend);

export default router;
