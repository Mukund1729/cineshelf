import express from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import {
  getPosts,
  getAdminPosts,
  publishSubmittedPost,
  getPostBySlug,
  createPost,
  submitPost,
  updatePost,
  deletePost,
} from '../controllers/blogController.js';

const router = express.Router();

// Public
router.get('/', getPosts);
router.get('/admin/posts', auth, admin, getAdminPosts);
router.patch('/admin/posts/:id/publish', auth, admin, publishSubmittedPost);
router.get('/:slug', getPostBySlug);

// Admin only
router.post('/', auth, admin, createPost);
router.put('/:id', auth, admin, updatePost);
router.delete('/:id', auth, admin, deletePost);

// Signed-in community members can submit drafts for admin review.
router.post('/submissions', auth, submitPost);

export default router;
