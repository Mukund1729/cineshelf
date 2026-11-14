import express from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import {
  getJournalAdminStatus,
  getJournalArticle,
  getJournalPosts,
  runJournalSync,
} from '../controllers/journalController.js';

const router = express.Router();

router.get('/', getJournalPosts);
router.get('/admin/status', auth, admin, getJournalAdminStatus);
router.post('/admin/sync', auth, admin, runJournalSync);
router.get('/:slug', getJournalArticle);

export default router;
