import express from 'express';
import auth from '../middleware/auth.js';
import { createDiaryEntry, deleteDiaryEntry, getDiaryEntries } from '../controllers/diaryController.js';

const router = express.Router();

router.get('/', auth, getDiaryEntries);
router.post('/', auth, createDiaryEntry);
router.delete('/:id', auth, deleteDiaryEntry);

export default router;
