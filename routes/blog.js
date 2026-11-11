import express from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import { getPosts, getPostBySlug, createPost, updatePost, deletePost } from '../controllers/blogController.js';

const router = express.Router();

// Public
router.get('/', getPosts);
router.get('/:slug', getPostBySlug);

// Admin only
router.post('/', auth, admin, createPost);
router.put('/:id', auth, admin, updatePost);
router.delete('/:id', auth, admin, deletePost);

export default router;
