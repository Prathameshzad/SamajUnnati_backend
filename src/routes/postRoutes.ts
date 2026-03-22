// src/routes/postRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadMiddleware } from '../middleware/uploadMiddleware';
import {
  createPost,
  getFeed,
  getUserPosts,
  getPost,
  deletePost,
  toggleLike,
  getPostLikes,
  addComment,
  getComments,
  deleteComment,
  sharePost,
} from '../controllers/postController';

const router = Router();
router.use(authMiddleware as any);

// Feed
router.get('/feed', getFeed as any);

// User's posts
router.get('/user/:userId', getUserPosts as any);

// Single post
router.get('/:id', getPost as any);

// Create post – up to 10 media files
router.post('/', uploadMiddleware.array('media', 10), createPost as any);

// Delete post
router.delete('/:id', deletePost as any);

// Like
router.post('/:id/like', toggleLike as any);
router.get('/:id/likes', getPostLikes as any);

// Comments
router.post('/:id/comments', addComment as any);
router.get('/:id/comments', getComments as any);
router.delete('/:id/comments/:commentId', deleteComment as any);

// Share
router.post('/:id/share', sharePost as any);

export default router;
