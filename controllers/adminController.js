import User from '../models/User.js';
import Watchlist from '../models/Watchlist.js';
import Review from '../models/Review.js';
import List from '../models/List.js';
import CustomList from '../models/CustomList.js';
import BlogPost from '../models/BlogPost.js';
import Notification from '../models/Notification.js';
import { getDatabaseStorageStats } from '../services/storageMonitor.js';

// GET /api/admin/users
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } },
      ];
    }
    const [users, total] = await Promise.all([
      User.find(query).select(
        '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
      ).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);
    res.json({ success: true, data: users, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
};

// GET /api/admin/users/:id
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
    );
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
};

// PUT /api/admin/users/:id
export const updateUser = async (req, res) => {
  try {
    const { username, email, isAdmin, isVerified } = req.body;
    // Only admin can set isAdmin — already protected by middleware
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { username, email, isAdmin, isVerified } },
      { new: true, runValidators: true }
    ).select(
      '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
    );
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};

// DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    // Clean up all user data
    await Promise.all([
      Watchlist.deleteMany({ user: req.params.id }),
      Review.deleteMany({ user: req.params.id }),
      List.deleteMany({ user: req.params.id }),
      CustomList.deleteMany({ user: req.params.id }),
      Notification.deleteMany({ user: req.params.id }),
    ]);
    res.json({ success: true, message: 'User and all associated data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

// POST /api/admin/users/create-admin
export const createAdminUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, error: 'Email already registered' });
    const user = await User.create({ name: name || username, username, email, password, isAdmin: true, isVerified: true });
    res.status(201).json({ success: true, data: { _id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin }, message: 'Admin user created' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create admin user' });
  }
};

// GET /api/admin/stats
export const getSystemStats = async (req, res) => {
  try {
    const [totalUsers, adminUsers, totalReviews, totalWatchlistItems, totalLists, totalBlogPosts, recentUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isAdmin: true }),
      Review.countDocuments(),
      Watchlist.aggregate([{ $project: { count: { $size: '$movies' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
      CustomList.countDocuments(),
      BlogPost.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    ]);

    const watchlistItemCount = totalWatchlistItems[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        adminUsers,
        totalReviews,
        totalWatchlistItems: watchlistItemCount,
        totalLists,
        totalBlogPosts,
        newUsersThisWeek: recentUsers,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Get system stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
};

export const getStorageStats = async (req, res) => {
  try {
    const data = await getDatabaseStorageStats();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Get database storage stats error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch database storage statistics' });
  }
};