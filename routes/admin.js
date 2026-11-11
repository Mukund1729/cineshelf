import express from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createAdminUser,
  getSystemStats,
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication AND admin role
router.use(auth, admin);

// Dashboard stats
router.get('/stats', getSystemStats);

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Create admin user (only existing admins can do this)
router.post('/users/create-admin', createAdminUser);

export default router;