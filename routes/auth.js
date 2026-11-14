import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  signup,
  login,
  verifyEmail,
  verifyOtp,
  sendOtp,
  resendVerificationCode,
  googleLogin,
  googleAuthStart,
  googleAuthCallback,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
} from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const verificationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

router.post('/signup', verificationLimiter, signup);
router.post('/verify-email', verificationLimiter, verifyEmail);
router.post('/verify-otp', verificationLimiter, verifyOtp);
router.post('/resend-verification', verificationLimiter, resendVerificationCode);
router.post('/send-otp', verificationLimiter, sendOtp);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleLogin);
router.get('/google', googleAuthStart);
router.get('/google/callback', googleAuthCallback);
router.get('/me', auth, getMe);
router.post('/forgot-password', verificationLimiter, forgotPassword);
router.post('/reset-password', verificationLimiter, resetPassword);
router.post('/logout', logout);

export default router;
