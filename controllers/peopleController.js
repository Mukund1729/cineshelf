import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Notification from '../models/Notification.js';

// GET /api/people/sakha — Get current user's friends
export const getSakha = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('sakha', 'username name avatar bio');
    res.json({ success: true, data: user?.sakha || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/people/request — Send friend request
export const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot send request to yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, error: 'User not found' });

    // Check if already friends
    const me = await User.findById(req.user.id);
    if (me.sakha.includes(userId)) {
      return res.status(409).json({ success: false, error: 'Already friends' });
    }

    // Check if request already exists
    const existing = await FriendRequest.findOne({
      $or: [
        { from: req.user.id, to: userId },
        { from: userId, to: req.user.id },
      ],
      status: 'pending',
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Friend request already exists' });
    }

    const request = await FriendRequest.create({ from: req.user.id, to: userId });

    // Create notification for recipient
    await Notification.create({
      user: userId,
      type: 'friend_request',
      message: `${me.username} sent you a friend request`,
      fromUser: req.user.id,
      relatedId: request._id,
    });

    res.status(201).json({ success: true, data: request, message: 'Friend request sent' });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/people/requests — Get pending friend requests for current user
export const getFriendRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.user.id, status: 'pending' })
      .populate('from', 'username name avatar bio')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/people/request/:id/accept — Accept a friend request
export const acceptFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOne({
      _id: req.params.id,
      to: req.user.id,
      status: 'pending',
    }).populate('from', 'username name avatar');

    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    request.status = 'accepted';
    await request.save();

    // Add each other as friends (sakha)
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { sakha: request.from._id } });
    await User.findByIdAndUpdate(request.from._id, { $addToSet: { sakha: req.user.id } });

    // Notify the sender
    const me = await User.findById(req.user.id).select('username');
    await Notification.create({
      user: request.from._id,
      type: 'friend_accepted',
      message: `${me.username} accepted your friend request`,
      fromUser: req.user.id,
      relatedId: request._id,
    });

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/people/request/:id/reject — Reject a friend request
export const rejectFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOneAndUpdate(
      { _id: req.params.id, to: req.user.id, status: 'pending' },
      { $set: { status: 'rejected' } },
      { new: true }
    );
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    res.json({ success: true, message: 'Friend request rejected' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// DELETE /api/people/sakha/:id — Remove a friend
export const removeSakha = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { sakha: req.params.id } });
    await User.findByIdAndUpdate(req.params.id, { $pull: { sakha: req.user.id } });
    // Also clean up any accepted friend request records
    await FriendRequest.deleteMany({
      $or: [
        { from: req.user.id, to: req.params.id },
        { from: req.params.id, to: req.user.id },
      ],
    });
    res.json({ success: true, message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/people/search — Search users (TMDB people search is in tmdb.ts)
export const searchPeople = async (req, res) => {
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
      _id: { $ne: req.user.id },
    }).select('username name avatar bio').limit(20);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
