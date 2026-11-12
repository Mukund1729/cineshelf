import express from 'express';
import auth from '../middleware/auth.js';
import { getConversation, sendMessage } from '../controllers/chatController.js';

const router = express.Router();

router.get('/:friendId', auth, getConversation);
router.post('/:friendId', auth, sendMessage);

export default router;
