import express from 'express';
import auth from '../middleware/auth.js';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  updateNotificationSettings 
} from '../controllers/notificationController.js';

const router = express.Router();

// Get user notifications
router.get('/', auth, getNotifications);

// Mark notification as read
router.put('/:id/read', auth, markAsRead);

// Mark all notifications as read
router.put('/read-all', auth, markAllAsRead);

// Delete notification
router.delete('/:id', auth, deleteNotification);

// Update notification settings
router.put('/settings', auth, updateNotificationSettings);

export default router; 