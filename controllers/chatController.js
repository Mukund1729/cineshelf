import mongoose from 'mongoose';
import ChatMessage from '../models/ChatMessage.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const getFriendId = (req, res) => {
  const { friendId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    res.status(400).json({ success: false, error: 'Invalid friend ID.' });
    return null;
  }
  if (friendId === req.user.id) {
    res.status(400).json({ success: false, error: 'You cannot message yourself.' });
    return null;
  }
  return friendId;
};

const ensureFriends = async (userId, friendId, res) => {
  const [friend, connection] = await Promise.all([
    User.findById(friendId).select('_id'),
    User.exists({ _id: userId, sakha: friendId }),
  ]);
  if (!friend) {
    res.status(404).json({ success: false, error: 'Friend not found.' });
    return false;
  }
  if (!connection) {
    res.status(403).json({ success: false, error: 'Chat is available to friends only.' });
    return false;
  }
  return true;
};

const serializeMessage = message => ({
  _id: message._id.toString(),
  senderId: message.sender.toString(),
  recipientId: message.recipient.toString(),
  text: message.text,
  createdAt: message.createdAt,
});

export const getConversation = async (req, res) => {
  try {
    const friendId = getFriendId(req, res);
    if (!friendId || !(await ensureFriends(req.user.id, friendId, res))) return;

    const limit = Number(req.query.limit || 40);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, error: 'Message page limit must be between 1 and 100.' });
    }

    const conversation = [
      { sender: req.user.id, recipient: friendId },
      { sender: friendId, recipient: req.user.id },
    ];
    let cursor = null;
    if (req.query.before !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(req.query.before)) {
        return res.status(400).json({ success: false, error: 'Invalid message cursor.' });
      }
      cursor = await ChatMessage.findOne({
        _id: req.query.before,
        $or: conversation,
      }).select('_id createdAt').lean();
      if (!cursor) {
        return res.status(400).json({ success: false, error: 'Message cursor is not in this conversation.' });
      }
    }

    const query = {
      $or: conversation.map(pair => {
        if (!cursor) return pair;
        return {
          ...pair,
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
          ],
        };
      }),
    };
    const page = await ChatMessage.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = page.length > limit;
    const messages = page.slice(0, limit).reverse();

    res.json({
      success: true,
      messages: messages.map(serializeMessage),
      hasMore,
      nextCursor: hasMore && messages.length ? messages[0]._id.toString() : null,
    });
  } catch (err) {
    console.error('Get chat conversation error:', err);
    res.status(500).json({ success: false, error: 'Could not load conversation.' });
  }
};

export const sendMessage = async (req, res) => {
  let message;
  try {
    const friendId = getFriendId(req, res);
    if (!friendId || !(await ensureFriends(req.user.id, friendId, res))) return;

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    if (text.length > 2000) return res.status(400).json({ success: false, error: 'Message must be 2000 characters or fewer.' });

    const sender = await User.findById(req.user.id).select('username');
    if (!sender) return res.status(401).json({ success: false, error: 'Please sign in again.' });

    message = await ChatMessage.create({
      sender: req.user.id,
      recipient: friendId,
      text,
    });

    try {
      await Notification.create({
        user: friendId,
        type: 'new_message',
        title: 'New message',
        message: `${sender.username} sent you a message`,
        fromUser: req.user.id,
        relatedId: message._id,
        data: { senderId: req.user.id },
        link: `/people?chat=${req.user.id}`,
      });
    } catch (notificationError) {
      console.error('Create chat notification error; message was retained:', notificationError);
    }

    res.status(201).json({ success: true, message: serializeMessage(message) });
  } catch (err) {
    console.error('Send chat message error:', err);
    res.status(500).json({ success: false, error: 'Could not send message.' });
  }
};
