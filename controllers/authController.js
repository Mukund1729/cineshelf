import User from '../models/User.js';
import Watchlist from '../models/Watchlist.js';
import { getOriginalWatchlistEntries } from '../services/originalFilmService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { sendVerificationCode } from '../services/emailService.js';

const googleClient = new OAuth2Client();
const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hashVerificationCode(email, code) {
  return createHmac('sha256', process.env.JWT_SECRET)
    .update(`${email}:${code}`)
    .digest('hex');
}

function clearVerificationCode(user) {
  user.emailVerificationCodeHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  user.emailVerificationSentAt = undefined;
  user.emailVerificationAttempts = 0;
}

function authUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
}

function issueAuthToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function ensureStarterWatchlist(user) {
  const existing = await Watchlist.exists({ user: user._id });
  if (!existing) {
    await Watchlist.create({
      user: user._id,
      movies: getOriginalWatchlistEntries(),
    });
  }
  if (user.originalWatchlistSeedVersion !== 1) {
    user.originalWatchlistSeedVersion = 1;
    await user.save();
  }
}

async function sendNewVerificationCode(user) {
  const now = new Date();
  if (user.emailVerificationSentAt
    && now.getTime() - user.emailVerificationSentAt.getTime() < OTP_RESEND_DELAY_MS) {
    return false;
  }
  const code = String(randomInt(100000, 1000000));
  user.emailVerificationCodeHash = hashVerificationCode(user.email, code);
  user.emailVerificationExpiresAt = new Date(now.getTime() + OTP_LIFETIME_MS);
  user.emailVerificationSentAt = now;
  user.emailVerificationAttempts = 0;
  await user.save();
  try {
    await sendVerificationCode(user.email, code);
  } catch (error) {
    user.emailVerificationSentAt = undefined;
    await user.save();
    throw error;
  }
  return true;
}

export const signup = async (req, res) => {
  try {
    const { name, username, password } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    if (typeof name !== 'string' || !name.trim()
      || typeof username !== 'string' || !username.trim()
      || !email
      || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      if (!emailExists.isVerified && emailExists.emailVerificationCodeHash) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_VERIFICATION_REQUIRED',
          verificationRequired: true,
          message: 'This account needs email verification. Request a new code.',
        });
      }
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const normalizedUsername = username.trim();
    const usernameExists = await User.findOne({ username: normalizedUsername });
    if (usernameExists) return res.status(409).json({ success: false, message: 'Username already taken' });

    try {
      const user = await User.create({
        name: name.trim(),
        username: normalizedUsername,
        email,
        password,
        isVerified: false,
      });
      try {
        await sendNewVerificationCode(user);
      } catch (mailError) {
        console.error('[Signup] Verification email delivery failed:', mailError.message);
        return res.status(503).json({
          success: false,
          verificationRequired: true,
          email,
          message: 'Account created, but the verification email could not be sent. Check email settings and request a new code.',
        });
      }
      return res.status(201).json({
        success: true,
        verificationRequired: true,
        email,
        message: 'A verification code has been sent to your email.',
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Email or username already registered' });
      }
      throw err;
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Signup error', error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { password } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.password) {
      return res.status(401).json({ success: false, message: 'Use Google sign-in for this account' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });
    if (!user.isVerified && user.emailVerificationCodeHash) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        verificationRequired: true,
        email,
        message: 'Verify your email before signing in.',
      });
    }

    // Update lastActive
    user.lastActive = new Date();
    await user.save();

    res.json({ success: true, token: issueAuthToken(user), user: authUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login error', error: err.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'A valid email and six-digit code are required' });
    }

    const user = await User.findOne({ email, isVerified: false, emailVerificationCodeHash: { $exists: true } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    if (user.emailVerificationAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect codes. Request a new one.' });
    }
    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code expired. Request a new one.' });
    }

    const expected = Buffer.from(user.emailVerificationCodeHash, 'hex');
    const supplied = Buffer.from(hashVerificationCode(email, code), 'hex');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      user.emailVerificationAttempts += 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    user.isVerified = true;
    clearVerificationCode(user);
    await user.save();
    await ensureStarterWatchlist(user);
    res.json({ success: true, token: issueAuthToken(user), user: authUser(user), message: 'Email verified' });
  } catch (error) {
    console.error('[Auth] Email verification failed:', error.message);
    res.status(500).json({ success: false, message: 'Email verification failed' });
  }
};

export const resendVerificationCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const user = await User.findOne({ email, isVerified: false, emailVerificationCodeHash: { $exists: true } });
    if (!user) {
      return res.json({ success: true, message: 'If verification is needed, a new code will be sent.' });
    }
    const sent = await sendNewVerificationCode(user);
    if (!sent) {
      return res.status(429).json({ success: false, message: 'Wait one minute before requesting another code.' });
    }
    res.json({ success: true, message: 'A new verification code has been sent.' });
  } catch (error) {
    console.error('[Auth] Verification email resend failed:', error.message);
    res.status(503).json({ success: false, message: 'Could not send verification email. Try again later.' });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const credential = req.body?.credential;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ success: false, message: 'Google sign-in is not configured on the server' });
    }
    if (typeof credential !== 'string' || !credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    } catch (error) {
      console.warn('[Auth] Invalid Google credential:', error.message);
      return res.status(401).json({ success: false, message: 'Google sign-in could not be verified' });
    }
    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email);
    if (!payload?.sub || !email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Google account email is not verified' });
    }

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) user = await User.findOne({ email });
    if (user) {
      if (user.googleId && user.googleId !== payload.sub) {
        return res.status(409).json({ success: false, message: 'This email is linked to a different Google account' });
      }
      user.googleId = payload.sub;
      user.isVerified = true;
      clearVerificationCode(user);
      if (payload.picture && /^https:\/\//i.test(payload.picture)) user.avatar = payload.picture;
      await user.save();
    } else {
      const baseUsername = (email.split('@')[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'cineaste');
      const username = `${baseUsername}-${randomBytes(3).toString('hex')}`;
      user = await User.create({
        name: payload.name || baseUsername,
        username,
        email,
        googleId: payload.sub,
        avatar: payload.picture && /^https:\/\//i.test(payload.picture) ? payload.picture : '',
        isVerified: true,
      });
    }

    await ensureStarterWatchlist(user);
    user.lastActive = new Date();
    await user.save();
    res.json({ success: true, token: issueAuthToken(user), user: authUser(user) });
  } catch (error) {
    console.error('[Auth] Google sign-in failed:', error.message);
    res.status(500).json({ success: false, message: 'Google sign-in failed' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'User fetch error' });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Return success anyway to prevent email enumeration
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.',
      });
    }

    // Generate reset token (NOT sent to client — would be emailed in production)
    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // TODO: In production, send email with reset link:
    // await sendEmail({ to: email, subject: 'Reset your password', body: `https://yoursite.com/reset-password?token=${resetToken}` });
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Password reset error', error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
    }
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Password reset error', error: err.message });
  }
};
