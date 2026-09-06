// src/routes/postRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadMediaArray } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter, uploadLimiter } from '../middleware/rateLimit';
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
import {
  addCommentSchema,
  commentsQuerySchema,
  createPostSchema,
  deleteCommentSchema,
  feedQuerySchema,
  postIdSchema,
  postLikesSchema,
  sharePostSchema,
  userPostsSchema,
} from '../schemas/contentSchemas';

const router = Router();
router.use(authMiddleware);

router.get('/feed', readLimiter, validate(feedQuerySchema), asyncHandler(getFeed));
router.get('/user/:userId', readLimiter, validate(userPostsSchema), asyncHandler(getUserPosts));

// Declared after the literal paths above so '/feed' is not captured by '/:id'.
router.get('/:id', readLimiter, validate(postIdSchema), asyncHandler(getPost));

// Up to 10 media files, content-verified before upload.
router.post(
  '/',
  uploadLimiter,
  ...uploadMediaArray('media', 10),
  validate(createPostSchema),
  asyncHandler(createPost)
);

router.delete('/:id', writeLimiter, validate(postIdSchema), asyncHandler(deletePost));

router.post('/:id/like', writeLimiter, validate(postIdSchema), asyncHandler(toggleLike));
router.get('/:id/likes', readLimiter, validate(postLikesSchema), asyncHandler(getPostLikes));

router.post('/:id/comments', writeLimiter, validate(addCommentSchema), asyncHandler(addComment));
router.get('/:id/comments', readLimiter, validate(commentsQuerySchema), asyncHandler(getComments));
router.delete(
  '/:id/comments/:commentId',
  writeLimiter,
  validate(deleteCommentSchema),
  asyncHandler(deleteComment)
);

router.post('/:id/share', writeLimiter, validate(sharePostSchema), asyncHandler(sharePost));

export default router;
