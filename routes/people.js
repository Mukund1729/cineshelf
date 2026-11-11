import express from 'express';
import auth from '../middleware/auth.js';
import {
  getSakha,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeSakha,
  searchPeople,
} from '../controllers/peopleController.js';

const router = express.Router();

// Friends (Sakha)
router.get('/sakha', auth, getSakha);
router.delete('/sakha/:id', auth, removeSakha);

// Friend requests
router.post('/request', auth, sendFriendRequest);
router.get('/requests', auth, getFriendRequests);
router.post('/request/:id/accept', auth, acceptFriendRequest);
router.post('/request/:id/reject', auth, rejectFriendRequest);

// Search users
router.get('/search', auth, searchPeople);

export default router;
