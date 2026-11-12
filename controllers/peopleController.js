import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Notification from '../models/Notification.js';
import Watchlist from '../models/Watchlist.js';
import Review from '../models/Review.js';
import mongoose from 'mongoose';

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
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, error: 'User not found' });

    // Check if already friends
    const me = await User.findById(req.user.id);
    if (me.sakha.some(friendId => friendId.toString() === userId)) {
      return res.status(409).json({ success: false, error: 'Already friends' });
    }

    const existing = await FriendRequest.findOne({
      $or: [
        { from: req.user.id, to: userId },
        { from: userId, to: req.user.id },
      ],
    });
    if (existing?.status === 'pending') {
      return res.status(409).json({ success: false, error: 'Friend request already exists' });
    }

    if (existing?.status === 'accepted') {
      return res.status(409).json({ success: false, error: 'Already friends' });
    }

    const reusingRequest = Boolean(existing);
    const request = existing || new FriendRequest({ from: req.user.id, to: userId });
    request.from = req.user.id;
    request.to = userId;
    request.status = 'pending';
    await request.save();

    try {
      await Notification.create({
        user: userId,
        type: 'friend_request',
        title: 'New friend request',
        message: `${me.username} sent you a friend request`,
        fromUser: req.user.id,
        relatedId: request._id,
        data: { requestId: request._id.toString(), fromUserId: req.user.id },
        link: '/people',
      });
    } catch (notificationError) {
      if (reusingRequest) {
        request.status = 'rejected';
        await request.save();
      } else {
        await request.deleteOne();
      }
      throw notificationError;
    }

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
      title: 'Friend request accepted',
      message: `${me.username} accepted your friend request`,
      fromUser: req.user.id,
      relatedId: request._id,
      data: { requestId: request._id.toString(), fromUserId: req.user.id },
      link: '/people',
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
    const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      $or: [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { name:     { $regex: escapedQuery, $options: 'i' } },
      ],
      _id: { $ne: req.user.id },
    }).select('username name avatar bio').limit(20).lean();

    const userIds = users.map(user => user._id);
    const [currentUser, pendingRequests] = await Promise.all([
      User.findById(req.user.id).select('sakha').lean(),
      FriendRequest.find({
        status: 'pending',
        $or: [
          { from: req.user.id, to: { $in: userIds } },
          { to: req.user.id, from: { $in: userIds } },
        ],
      }).select('from to').lean(),
    ]);

    const friendIds = new Set((currentUser?.sakha || []).map(id => id.toString()));
    const requestsByUserId = new Map();
    pendingRequests.forEach(request => {
      const otherUserId = request.from.toString() === req.user.id
        ? request.to.toString()
        : request.from.toString();
      requestsByUserId.set(otherUserId, request.from.toString() === req.user.id ? 'outgoing' : 'incoming');
    });

    const data = users.map(user => ({
      ...user,
      relation: friendIds.has(user._id.toString())
        ? 'friend'
        : requestsByUserId.get(user._id.toString()) || 'none',
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Search people error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/people/profile/:userId — View a person's profile and public cinema activity
export const getPersonProfile = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });
    }

    const person = await User.findById(req.params.userId)
      .select('username name avatar bio socials sakha favouriteGenres favouriteMovies preferences.privacy')
      .lean();
    if (!person) return res.status(404).json({ success: false, error: 'User not found' });

    const viewer = await User.findById(req.user.id).select('sakha').lean();
    if (!viewer) return res.status(401).json({ success: false, error: 'Please sign in.' });

    const isOwnProfile = person._id.toString() === req.user.id;
    const isFriend = (person.sakha || []).some(id => id.toString() === req.user.id);
    const privacy = person.preferences?.privacy || {};
    const visibility = privacy.profileVisibility || 'public';

    if (!isOwnProfile && visibility === 'private') {
      return res.status(403).json({ success: false, error: 'This profile is private.' });
    }
    if (!isOwnProfile && visibility === 'friends' && !isFriend) {
      return res.status(403).json({ success: false, error: 'This profile is visible to friends only.' });
    }

    const request = !isOwnProfile && !isFriend
      ? await FriendRequest.findOne({
        status: 'pending',
        $or: [
          { from: req.user.id, to: person._id },
          { from: person._id, to: req.user.id },
        ],
      }).select('from')
      : null;
    const relation = isOwnProfile
      ? 'self'
      : isFriend
        ? 'friend'
        : request
          ? (request.from.toString() === req.user.id ? 'outgoing' : 'incoming')
          : 'none';
    const canSeeWatchlist = isOwnProfile || privacy.showWatchlist !== false;
    const canSeeReviews = isOwnProfile || privacy.showReviews !== false;

    const [watchlist, reviews] = await Promise.all([
      canSeeWatchlist ? Watchlist.findOne({ user: person._id }).select('movies').lean() : null,
      canSeeReviews
        ? Review.find({ user: person._id })
          .select('tmdbId title poster rating review mediaType createdAt')
          .sort({ createdAt: -1 })
          .limit(12)
          .lean()
        : [],
    ]);

    const { sakha: _friends, preferences: _preferences, ...publicPerson } = person;
    res.json({
      success: true,
      data: {
        profile: publicPerson,
        relation,
        watchlistVisible: canSeeWatchlist,
        watchlist: canSeeWatchlist ? (watchlist?.movies || []).slice(0, 30) : [],
        reviewsVisible: canSeeReviews,
        reviews,
      },
    });
  } catch (err) {
    console.error('Get person profile error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
