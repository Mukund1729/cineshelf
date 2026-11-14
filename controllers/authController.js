import User from '../models/User.js';
import Watchlist from '../models/Watchlist.js';
import { getOriginalWatchlistEntries } from '../services/originalFilmService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const signup = async (req, res) => {
  const { name, username, email, password } = req.body;
  try {
    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(409).json({ success: false, message: 'Email already registered' });

    const usernameExists = await User.findOne({ username });
    if (usernameExists) return res.status(409).json({ success: false, message: 'Username already taken' });

    const user = await User.create({ name, username, email, password });
    try {
      await Watchlist.create({
        user: user._id,
        movies: getOriginalWatchlistEntries(),
      });
      await User.updateOne(
        { _id: user._id },
        { $set: { originalWatchlistSeedVersion: 1 } }
      );
    } catch (watchlistError) {
      console.error('[Signup] Original-film watchlist initialization failed:', watchlistError.message);
      return res.status(500).json({
        success: false,
        accountCreated: true,
        message: 'Your account was created, but the starter watchlist could not be initialized. Sign in and contact support to complete setup.',
        error: 'watchlist_initialization_failed',
      });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const userObj = {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };
    res.status(201).json({ success: true, message: 'Signup successful', token, user: userObj });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Signup error', error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });

    // Update lastActive
    user.lastActive = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userObj = {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };
    res.json({ success: true, token, user: userObj });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login error', error: err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
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
