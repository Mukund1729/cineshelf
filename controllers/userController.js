import User from '../models/User.js';
import UserAvatar from '../models/UserAvatar.js';
import bcrypt from 'bcryptjs';

// Get current user profile — returns consistent { success, data: user } format
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
    );
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Update user profile — never allow isAdmin update through this endpoint
export const updateProfile = async (req, res) => {
  try {
    const { name, username, bio, avatar, socials, favouriteGenres, favouriteMovies } = req.body;

    // Build safe update — explicitly exclude isAdmin, isVerified, password
    const updateData = {};
    if (name !== undefined)            updateData.name = name;
    if (username !== undefined)        updateData.username = username;
    if (bio !== undefined)             updateData.bio = bio;
    if (avatar !== undefined)          updateData.avatar = avatar;
    if (socials !== undefined)         updateData.socials = socials;
    if (favouriteGenres !== undefined) updateData.favouriteGenres = favouriteGenres;
    if (favouriteMovies !== undefined) updateData.favouriteMovies = favouriteMovies;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select(
      '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
    );

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user, message: 'Profile updated' });
  } catch (err) {
    console.error('Profile update error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Username already taken' });
    }
    res.status(500).json({ success: false, error: 'Update failed' });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Old and new passwords are required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(400).json({ success: false, error: 'Old password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: 'Password change failed' });
  }
};

// Get user preferences
export const getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');
    res.json({ success: true, data: user?.preferences || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
};

// Update user preferences
export const updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { preferences } },
      { new: true, runValidators: true }
    ).select('preferences');
    res.json({ success: true, data: user?.preferences });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
};

// Upload/set avatar
export const uploadAvatar = async (req, res) => {
  try {
    let avatarUrl = req.body.avatarUrl;

    if (req.file) {
      const storedAvatar = await UserAvatar.findOneAndUpdate(
        { userId: req.user.id },
        {
          $set: {
            data: req.file.buffer,
            contentType: req.file.mimetype,
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
      avatarUrl = `/api/user/avatar/${req.user.id}?v=${storedAvatar.updatedAt.getTime()}`;
    }

    if (!avatarUrl) {
      return res.status(400).json({ success: false, error: 'No avatar URL or file provided' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatar: avatarUrl } },
      { new: true, runValidators: true }
    ).select(
      '-password -googleId -emailVerificationCodeHash -emailVerificationExpiresAt -emailVerificationSentAt -emailVerificationAttempts -resetPasswordToken -resetPasswordExpires'
    );

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { user, avatarUrl } });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ success: false, error: 'Failed to upload avatar' });
  }
};

export const getAvatar = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const avatar = await UserAvatar.findOne({ userId: req.params.userId })
      .select('data contentType updatedAt');
    if (!avatar) return res.status(404).json({ success: false, error: 'Avatar not found' });

    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Last-Modified': avatar.updatedAt.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    res.type(avatar.contentType);
    res.send(avatar.data);
  } catch (err) {
    console.error('Avatar retrieval error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve avatar' });
  }
};

// Get friends (sakha) list
export const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('sakha', 'username name avatar bio createdAt');
    res.json({ success: true, data: user?.sakha || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get friends' });
  }
};

// Search users by username or name
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
    }
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { name:     { $regex: q, $options: 'i' } },
      ],
      _id: { $ne: req.user.id }, // Exclude self
    }).select('username name avatar bio').limit(20);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
};

// Get public profile of another user (by username)
export const getPublicProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -email -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
