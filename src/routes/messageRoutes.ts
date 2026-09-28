// src/routes/messageRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadOptionalMedia } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter, uploadLimiter } from '../middleware/rateLimit';
import {
  listConversations,
  getOrCreateDirectConversation,
  createGroupConversation,
  getMessages,
  sendMessage,
  deleteMessage,
  getMessagableContacts,
  updateGroupInfo,
  addGroupMember,
  getConversationInfo,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateGroupSettings,
  updateMemberRole,
  removeGroupMember,
  leaveGroup,
  createInviteLink,
  revokeInviteLink,
  previewInvite,
  joinViaInvite,
  listJoinRequests,
  resolveJoinRequest,
} from '../controllers/messageController';
import {
  addGroupMemberSchema,
  blockUserSchema,
  contactsSchema,
  conversationIdSchema,
  conversationMemberParamSchema,
  createGroupSchema,
  directConversationSchema,
  getMessagesSchema,
  inviteCodeParamSchema,
  listConversationsSchema,
  messageIdSchema,
  resolveJoinRequestSchema,
  sendMessageSchema,
  updateGroupSchema,
  updateGroupSettingsSchema,
  updateMemberRoleSchema,
} from '../schemas/messageSchemas';

const router = Router();
router.use(authMiddleware);

// Contact discovery
router.get('/contacts', readLimiter, validate(contactsSchema), asyncHandler(getMessagableContacts));

// Block management
router.post('/block', writeLimiter, validate(blockUserSchema), asyncHandler(blockUser));
router.post('/unblock', writeLimiter, validate(blockUserSchema), asyncHandler(unblockUser));
router.get('/blocked', readLimiter, asyncHandler(getBlockedUsers));

// Conversations
router.get(
  '/conversations',
  readLimiter,
  validate(listConversationsSchema),
  asyncHandler(listConversations)
);
router.post(
  '/conversations/direct',
  writeLimiter,
  validate(directConversationSchema),
  asyncHandler(getOrCreateDirectConversation)
);
router.post(
  '/conversations/group',
  uploadLimiter,
  ...uploadOptionalMedia('photo', ['image']),
  validate(createGroupSchema),
  asyncHandler(createGroupConversation)
);
router.get(
  '/conversations/:conversationId/info',
  readLimiter,
  validate(conversationIdSchema),
  asyncHandler(getConversationInfo)
);
router.patch(
  '/conversations/:conversationId',
  writeLimiter,
  ...uploadOptionalMedia('photo', ['image']),
  validate(updateGroupSchema),
  asyncHandler(updateGroupInfo)
);
router.post(
  '/conversations/:conversationId/members',
  writeLimiter,
  validate(addGroupMemberSchema),
  asyncHandler(addGroupMember)
);

// Group permissions ("Member capabilities" screen)
router.patch(
  '/conversations/:conversationId/settings',
  writeLimiter,
  validate(updateGroupSettingsSchema),
  asyncHandler(updateGroupSettings)
);

// Member management: promote/demote, remove, leave
router.patch(
  '/conversations/:conversationId/members/:memberUserId/role',
  writeLimiter,
  validate(updateMemberRoleSchema),
  asyncHandler(updateMemberRole)
);
router.delete(
  '/conversations/:conversationId/members/:memberUserId',
  writeLimiter,
  validate(conversationMemberParamSchema),
  asyncHandler(removeGroupMember)
);
router.post(
  '/conversations/:conversationId/leave',
  writeLimiter,
  validate(conversationIdSchema),
  asyncHandler(leaveGroup)
);

// Invite links
router.post(
  '/conversations/:conversationId/invite',
  writeLimiter,
  validate(conversationIdSchema),
  asyncHandler(createInviteLink)
);
router.delete(
  '/conversations/:conversationId/invite',
  writeLimiter,
  validate(conversationIdSchema),
  asyncHandler(revokeInviteLink)
);
router.get(
  '/invite/:code',
  readLimiter,
  validate(inviteCodeParamSchema),
  asyncHandler(previewInvite)
);
router.post(
  '/invite/:code/join',
  writeLimiter,
  validate(inviteCodeParamSchema),
  asyncHandler(joinViaInvite)
);

// Join-request approval queue ("Approve new members")
router.get(
  '/conversations/:conversationId/join-requests',
  readLimiter,
  validate(conversationIdSchema),
  asyncHandler(listJoinRequests)
);
router.patch(
  '/conversations/:conversationId/join-requests/:requestId',
  writeLimiter,
  validate(resolveJoinRequestSchema),
  asyncHandler(resolveJoinRequest)
);

// Messages within a conversation
router.get(
  '/conversations/:conversationId/messages',
  readLimiter,
  validate(getMessagesSchema),
  asyncHandler(getMessages)
);
router.post(
  '/conversations/:conversationId/messages',
  writeLimiter,
  ...uploadOptionalMedia('media'),
  validate(sendMessageSchema),
  asyncHandler(sendMessage)
);
router.delete('/messages/:messageId', writeLimiter, validate(messageIdSchema), asyncHandler(deleteMessage));

export default router;
