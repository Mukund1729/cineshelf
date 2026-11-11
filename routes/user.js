import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  changePassword,
  getPreferences,
  updatePreferences,
  uploadAvatar,
  getFriends,
  searchUsers,
  getPublicProfile,
} from '../controllers/userController.js';

const router = express.Router();

// Multer for avatar uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum 5MB.' });
    }
    return res.status(400).json({ success: false, error: 'File upload error: ' + err.message });
  } else if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
};

// Profile routes
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.put('/password', auth, changePassword);
router.get('/preferences', auth, getPreferences);
router.put('/preferences', auth, updatePreferences);
router.post('/avatar', auth, upload.single('avatar'), handleMulterError, uploadAvatar);

// Friends / Sakha routes
router.get('/friends', auth, getFriends);

// Search users
router.get('/search', auth, searchUsers);

// Public profile (by username)
router.get('/u/:username', getPublicProfile);

export default router;
