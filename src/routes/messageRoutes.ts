// src/routes/messageRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadMiddleware } from '../middleware/uploadMiddleware';
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
} from '../controllers/messageController';

const router = Router();

router.use(authMiddleware);

// Contact discovery
router.get('/contacts', getMessagableContacts);

// Block management
router.post('/block', blockUser);
router.post('/unblock', unblockUser);
router.get('/blocked', getBlockedUsers);

// Conversations
router.get('/conversations', listConversations);
router.post('/conversations/direct', getOrCreateDirectConversation);
router.post('/conversations/group', uploadMiddleware.single('photo'), createGroupConversation);
router.get('/conversations/:conversationId/info', getConversationInfo);
router.patch('/conversations/:conversationId', uploadMiddleware.single('photo'), updateGroupInfo);
router.post('/conversations/:conversationId/members', addGroupMember);

// Messages within a conversation
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', uploadMiddleware.single('media'), sendMessage);
router.delete('/messages/:messageId', deleteMessage);

export default router;
