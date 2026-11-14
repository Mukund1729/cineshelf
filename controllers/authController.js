import User from '../models/User.js';
import AuthOtp from '../models/AuthOtp.js';
import Watchlist from '../models/Watchlist.js';
import { getOriginalWatchlistEntries } from '../services/originalFilmService.js';
import bcrypt from 'bcryptjs';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import {
  sendLoginCode,
  sendPasswordResetCode,
  sendVerificationCode,
  sendWelcomeEmail,
} from '../services/emailService.js';
import {
  clearSessionCookie,
  issueSessionToken,
  readCookie,
  setSessionCookie,
} from '../services/authSession.js';

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OAUTH_STATE_COOKIE = 'vc_google_state';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashOtp(email, purpose, code) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return createHmac('sha256', process.env.JWT_SECRET)
    .update(`${email}:${purpose}:${code}`)
    .digest('hex');
}

function matchesHash(expectedHash, suppliedHash) {
  if (!/^[\da-f]{64}$/i.test(expectedHash) || !/^[\da-f]{64}$/i.test(suppliedHash)) return false;
  return timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(suppliedHash, 'hex'));
}

function validPassword(password) {
  return typeof password === 'string'
    && Buffer.byteLength(password, 'utf8') >= 8
    && Buffer.byteLength(password, 'utf8') <= 72;
}

function clearLegacyVerification(user) {
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

function authenticateUser(req, res, user, message = 'Signed in successfully') {
  setSessionCookie(req, res, issueSessionToken(user));
  return res.json({ success: true, user: authUser(user), message });
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

async function createUsername(email, requestedUsername) {
  if (requestedUsername !== undefined) {
    if (typeof requestedUsername !== 'string'
      || !/^[a-zA-Z0-9._-]{3,30}$/.test(requestedUsername.trim())) {
      throw Object.assign(new Error('Enter a username containing 3 to 30 letters, numbers, dots, or hyphens.'), {
        status: 400,
      });
    }
    const username = requestedUsername.trim();
    if (await User.exists({ username })) {
      throw Object.assign(new Error('Username already taken'), { status: 409 });
    }
    return username;
  }

  const localPart = email.split('@')[0];
  const base = localPart.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'cineaste';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = `${base}-${randomBytes(3).toString('hex')}`;
    if (!await User.exists({ username })) return username;
  }
  throw new Error('Could not create a unique username');
}

function sendCodeByPurpose(email, code, purpose) {
  if (purpose === 'verification') return sendVerificationCode(email, code);
  if (purpose === 'reset') return sendPasswordResetCode(email, code);
  return sendLoginCode(email, code);
}

async function issueOtp(email, purpose) {
  const now = new Date();
  const existing = await AuthOtp.findOne({ email, purpose });
  if (existing && now.getTime() - existing.createdAt.getTime() < OTP_RESEND_DELAY_MS) {
    return false;
  }

  const code = String(randomInt(100000, 1000000));
  const otpHash = hashOtp(email, purpose, code);
  const values = {
    otpHash,
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
  };

  if (existing) {
    const updated = await AuthOtp.findOneAndUpdate(
      { _id: existing._id, createdAt: existing.createdAt },
      { $set: values },
      { new: true },
    );
    if (!updated) return false;
  } else {
    try {
      await AuthOtp.create({ email, purpose, ...values });
    } catch (error) {
      if (error.code === 11000) return false;
      throw error;
    }
  }

  try {
    await sendCodeByPurpose(email, code, purpose);
  } catch (error) {
    await AuthOtp.deleteOne({ email, purpose, otpHash });
    throw error;
  }
  return true;
}

async function incrementOtpAttempt(otp) {
  const updated = await AuthOtp.findOneAndUpdate(
    { _id: otp._id, attempts: { $lt: MAX_OTP_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true },
  );
  return updated ? updated.attempts : MAX_OTP_ATTEMPTS;
}

function setOAuthStateCookie(req, res, state, clear = false) {
  const secure = process.env.NODE_ENV === 'production' || req.secure;
  const parts = [
    `${OAUTH_STATE_COOKIE}=${clear ? '' : encodeURIComponent(state)}`,
    'Path=/api/auth/google/callback',
    `Max-Age=${clear ? 0 : OAUTH_STATE_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function isOAuthStateValid(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string'
    || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

function getFrontendUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');
  const origins = (process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGINS || '')
    .split(',').map(origin => origin.trim()).filter(Boolean);
  return origins.find(origin => !/^https?:\/\/localhost(?::\d+)?$/i.test(origin))
    || 'https://cineshelf-eight.vercel.app';
}

async function findOrCreateGoogleUser(payload) {
  const email = normalizeEmail(payload.email);
  let user = await User.findOne({ googleId: payload.sub });
  if (!user) user = await User.findOne({ email });

  if (user) {
    if (user.googleId && user.googleId !== payload.sub) {
      throw Object.assign(new Error('This email is linked to a different Google account'), { status: 409 });
    }
    user.googleId = payload.sub;
    user.isVerified = true;
    clearLegacyVerification(user);
    if (payload.picture && /^https:\/\//i.test(payload.picture)) user.avatar = payload.picture;
    await user.save();
    await AuthOtp.deleteMany({ email, purpose: 'verification' });
    return { user, created: false };
  }

  const username = await createUsername(email);
  user = await User.create({
    name: typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim().slice(0, 80)
      : username,
    username,
    email,
    googleId: payload.sub,
    avatar: payload.picture && /^https:\/\//i.test(payload.picture) ? payload.picture : '',
    isVerified: true,
  });
  return { user, created: true };
}

async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw Object.assign(new Error('Google sign-in is not configured on the server'), { status: 503 });
  if (typeof credential !== 'string' || !credential) {
    throw Object.assign(new Error('Google credential is required'), { status: 400 });
  }
  const ticket = await new OAuth2Client().verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !isValidEmail(normalizeEmail(payload.email)) || payload.email_verified !== true) {
    throw Object.assign(new Error('Google account email is not verified'), { status: 401 });
  }
  return payload;
}

async function finishGoogleSignIn(req, res, payload) {
  const { user, created } = await findOrCreateGoogleUser(payload);
  await ensureStarterWatchlist(user);
  user.lastActive = new Date();
  await user.save();
  if (created) {
    sendWelcomeEmail(user.email, user.name).catch(error => {
      console.error('[Auth] Welcome email delivery failed:', error.message);
    });
  }
  return authenticateUser(req, res, user, 'Google sign-in successful');
}

export const signup = async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body || {};
    if (name.length < 2 || name.length > 80 || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter your name and a valid email address.' });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must be 8 to 72 bytes long.' });
    }
    if (await User.exists({ email })) {
      try {
        const sent = await issueOtp(email, 'login');
        if (!sent) {
          return res.status(429).json({
            success: false,
            message: 'Wait one minute before requesting another code.',
          });
        }
        return res.json({
          success: true,
          email,
          otpPurpose: 'login',
          message: 'An account may already use this email. A sign-in code has been sent if it can receive one.',
        });
      } catch (error) {
        console.error('[Auth] Existing-account sign-in email failed:', error.message);
        const message = error.message.startsWith('Email service is not configured:')
          ? error.message
          : 'Could not send a sign-in code. Try again later.';
        return res.status(503).json({ success: false, message });
      }
    }

    const username = await createUsername(email, req.body?.username);
    let user;
    try {
      user = await User.create({ name, username, email, password, isVerified: false });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'USERNAME_TAKEN',
          message: 'That username is already in use. Choose another one.',
        });
      }
      throw error;
    }

    try {
      const sent = await issueOtp(email, 'verification');
      if (!sent) throw new Error('Verification code could not be issued. Please try again.');
    } catch (error) {
      console.error('[Auth] Verification email delivery failed:', error.message);
      return res.status(503).json({
        success: false,
        verificationRequired: true,
        email,
        message: error.message.startsWith('Email service is not configured:')
          ? error.message
          : 'We could not send the verification email. Check email settings and try again.',
      });
    }
    return res.status(201).json({
      success: true,
      verificationRequired: true,
      email,
      message: 'A verification code has been sent to your email.',
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('[Auth] Signup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not create your account.' });
  }
};

export const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isValidEmail(email) || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Enter a valid email and password.' });
    }

    const user = await User.findOne({ email });
    const passwordMatches = user?.password
      ? await bcrypt.compare(password, user.password)
      : false;
    if (!user || !passwordMatches || !user.isVerified) {
      return res.status(401).json({ success: false, message: 'Email or password is incorrect. Verify your email or use email sign-in.' });
    }

    user.lastActive = new Date();
    await user.save();
    return authenticateUser(req, res, user, 'Welcome back');
  } catch (error) {
    console.error('[Auth] Login failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not sign in. Try again later.' });
  }
};

export const sendOtp = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }

  try {
    const sent = await issueOtp(email, 'login');
    if (!sent) {
      return res.status(429).json({ success: false, message: 'Wait one minute before requesting another code.' });
    }
    return res.json({ success: true, message: 'If this address can receive sign-in codes, one is on its way.' });
  } catch (error) {
    console.error('[Auth] Sign-in email delivery failed:', error.message);
    const message = error.message.startsWith('Email service is not configured:')
      ? error.message
      : 'We could not send a sign-in code. Try again later.';
    return res.status(503).json({ success: false, message });
  }
};

export const verifyOtp = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const purpose = req.body?.purpose === 'verification' ? 'verification' : 'login';
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email and six-digit code.' });
  }

  try {
    const otp = await AuthOtp.findOne({ email, purpose });
    if (!otp && purpose === 'verification') {
      return verifyLegacyEmailCode(req, res, email, code);
    }
    if (!otp) return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
    if (otp.expiresAt <= new Date()) {
      await AuthOtp.deleteOne({ _id: otp._id });
      return res.status(400).json({ success: false, message: 'Code expired. Request a new one.' });
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect codes. Request a new one.' });
    }

    const hashMatches = matchesHash(otp.otpHash, hashOtp(email, purpose, code));
    if (!hashMatches) {
      const attempts = await incrementOtpAttempt(otp);
      return res.status(attempts >= MAX_OTP_ATTEMPTS ? 429 : 400).json({
        success: false,
        message: attempts >= MAX_OTP_ATTEMPTS
          ? 'Too many incorrect codes. Request a new one.'
          : 'Invalid or expired code.',
      });
    }

    let user = await User.findOne({ email });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!user && purpose !== 'login') {
      return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
    }
    if (!user && (name.length < 2 || name.length > 80)) {
      return res.status(400).json({
        success: false,
        code: 'NAME_REQUIRED',
        message: 'Enter your name to finish creating your account.',
      });
    }
    const newUsername = user ? null : await createUsername(email, req.body?.username);

    const consumed = await AuthOtp.findOneAndDelete({
      _id: otp._id,
      otpHash: otp.otpHash,
      attempts: { $lt: MAX_OTP_ATTEMPTS },
      expiresAt: { $gt: new Date() },
    });
    if (!consumed) return res.status(400).json({ success: false, message: 'Invalid or expired code.' });

    let created = false;
    if (!user) {
      try {
        user = await User.create({ name, username: newUsername, email, isVerified: true });
        created = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOne({ email });
        if (!user) throw error;
      }
    }
    user.isVerified = true;
    clearLegacyVerification(user);
    user.lastActive = new Date();
    await user.save();
    await ensureStarterWatchlist(user);
    if (created) {
      sendWelcomeEmail(user.email, user.name).catch(error => {
        console.error('[Auth] Welcome email delivery failed:', error.message);
      });
    }
    return authenticateUser(req, res, user, 'Email verified. You are signed in.');
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('[Auth] Code verification failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not verify the code. Try again later.' });
  }
};

async function verifyLegacyEmailCode(req, res, email, code) {
  const user = await User.findOne({
    email,
    isVerified: false,
    emailVerificationCodeHash: { $exists: true },
  });
  if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
    return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
  }
  if (user.emailVerificationAttempts >= MAX_OTP_ATTEMPTS) {
    return res.status(429).json({ success: false, message: 'Too many incorrect codes. Request a new one.' });
  }
  const expected = Buffer.from(user.emailVerificationCodeHash, 'hex');
  const supplied = createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest();
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    user.emailVerificationAttempts += 1;
    await user.save();
    return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
  }
  user.isVerified = true;
  clearLegacyVerification(user);
  user.lastActive = new Date();
  await user.save();
  await ensureStarterWatchlist(user);
  sendWelcomeEmail(user.email, user.name).catch(error => {
    console.error('[Auth] Welcome email delivery failed:', error.message);
  });
  return authenticateUser(req, res, user, 'Email verified. You are signed in.');
}

export const verifyEmail = (req, res) => {
  req.body = { ...req.body, purpose: 'verification' };
  return verifyOtp(req, res);
};

export const resendVerificationCode = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  try {
    const user = await User.findOne({ email, isVerified: false });
    if (!user) return res.json({ success: true, message: 'If verification is needed, a new code will be sent.' });
    const sent = await issueOtp(email, 'verification');
    if (!sent) return res.status(429).json({ success: false, message: 'Wait one minute before requesting another code.' });
    return res.json({ success: true, message: 'A new verification code has been sent.' });
  } catch (error) {
    console.error('[Auth] Verification email resend failed:', error.message);
    const message = error.message.startsWith('Email service is not configured:')
      ? error.message
      : 'Could not send a verification code. Try again later.';
    return res.status(503).json({ success: false, message });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const payload = await verifyGoogleCredential(req.body?.credential);
    return await finishGoogleSignIn(req, res, payload);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('[Auth] Google sign-in failed:', error.message);
    return res.status(401).json({ success: false, message: 'Google sign-in could not be verified.' });
  }
};

export const googleAuthStart = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL;
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(503).json({
      success: false,
      message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.',
    });
  }

  const state = randomBytes(32).toString('hex');
  setOAuthStateCookie(req, res, state);
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return res.redirect(client.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state,
  }));
};

export const googleAuthCallback = async (req, res) => {
  const state = req.query?.state;
  const storedState = readCookie(req, OAUTH_STATE_COOKIE);
  setOAuthStateCookie(req, res, '', true);
  if (!isOAuthStateValid(storedState, state)) {
    return res.redirect(303, `${getFrontendUrl()}/?auth=google-error`);
  }
  if (typeof req.query?.code !== 'string'
    || !process.env.GOOGLE_CLIENT_ID
    || !process.env.GOOGLE_CLIENT_SECRET
    || !process.env.GOOGLE_CALLBACK_URL) {
    return res.redirect(303, `${getFrontendUrl()}/?auth=google-error`);
  }

  try {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL,
    );
    const { tokens } = await client.getToken({
      code: req.query.code,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    });
    if (!tokens.id_token) throw new Error('Google did not return an ID token');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !isValidEmail(normalizeEmail(payload.email)) || payload.email_verified !== true) {
      throw new Error('Google account email is not verified');
    }
    const { user, created } = await findOrCreateGoogleUser(payload);
    await ensureStarterWatchlist(user);
    user.lastActive = new Date();
    await user.save();
    if (created) {
      sendWelcomeEmail(user.email, user.name).catch(error => {
        console.error('[Auth] Welcome email delivery failed:', error.message);
      });
    }
    setSessionCookie(req, res, issueSessionToken(user));
    return res.redirect(303, `${getFrontendUrl()}/`);
  } catch (error) {
    console.error('[Auth] Google OAuth callback failed:', error.message);
    return res.redirect(303, `${getFrontendUrl()}/?auth=google-error`);
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
    );
    if (!user) {
      clearSessionCookie(req, res);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: user });
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load the current user.' });
  }
};

export const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  try {
    if (await User.exists({ email })) {
      const sent = await issueOtp(email, 'reset');
      if (!sent) {
        return res.status(429).json({ success: false, message: 'Wait one minute before requesting another code.' });
      }
    }
    return res.json({
      success: true,
      message: 'If an account exists with this email, a password reset code has been sent.',
    });
  } catch (error) {
    console.error('[Auth] Password reset email delivery failed:', error.message);
    const message = error.message.startsWith('Email service is not configured:')
      ? error.message
      : 'Could not send a password reset code. Try again later.';
    return res.status(503).json({ success: false, message });
  }
};

export const resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const newPassword = req.body?.newPassword;
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email and six-digit reset code.' });
  }
  if (!validPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Password must be 8 to 72 bytes long.' });
  }

  try {
    const otp = await AuthOtp.findOne({ email, purpose: 'reset' });
    const user = await User.findOne({ email });
    if (!otp || !user || otp.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect codes. Request a new one.' });
    }
    if (!matchesHash(otp.otpHash, hashOtp(email, 'reset', code))) {
      const attempts = await incrementOtpAttempt(otp);
      return res.status(attempts >= MAX_OTP_ATTEMPTS ? 429 : 400).json({
        success: false,
        message: attempts >= MAX_OTP_ATTEMPTS
          ? 'Too many incorrect codes. Request a new one.'
          : 'Invalid or expired reset code.',
      });
    }

    const consumed = await AuthOtp.findOneAndDelete({
      _id: otp._id,
      otpHash: otp.otpHash,
      attempts: { $lt: MAX_OTP_ATTEMPTS },
      expiresAt: { $gt: new Date() },
    });
    if (!consumed) return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    await AuthOtp.deleteMany({ email, purpose: 'reset' });
    return res.json({ success: true, message: 'Password reset. You can now sign in.' });
  } catch (error) {
    console.error('[Auth] Password reset failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not reset the password. Try again later.' });
  }
};

export const logout = (req, res) => {
  clearSessionCookie(req, res);
  return res.json({ success: true, message: 'Signed out.' });
};
