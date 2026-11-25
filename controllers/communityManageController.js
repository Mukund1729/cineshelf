// Community setup and management handlers: availability checks, settings,
// images, membership requests and post moderation. They extend the existing
// community API (same models, same router) — see communityController.js for
// browsing, joining and posting.
import mongoose from 'mongoose';
import Community from '../models/Community.js';
import CommunityMember from '../models/CommunityMember.js';
import CommunityPost from '../models/CommunityPost.js';
import CommunityComment from '../models/CommunityComment.js';
import CommunityBookmark from '../models/CommunityBookmark.js';
import CommunityImage from '../models/CommunityImage.js';
import { slugifyCommunity } from '../data/communityOptions.js';
import {
  cleanLine,
  sniffImageType,
  validateCommunityInput,
  validateSlug,
} from '../services/communityValidation.js';
import {
  AUTHOR_SELECT,
  canViewCommunity,
  findCommunityByName,
  getMembership,
  isStaff,
  notifyUsers,
  serializeCommunity,
  sortMembersByRole,
  suggestAvailableSlug,
} from './communityController.js';

const IMAGE_KINDS = ['avatar', 'cover'];
const MEMBER_ACTIONS = ['approve', 'decline', 'remove', 'ban', 'unban', 'promote', 'demote'];
const MEMBER_STATUSES = ['active', 'pending', 'banned'];

function isOwner(membership) {
  return isStaff(membership) && membership.role === 'owner';
}

async function loadCommunity(slug) {
  return Community.findOne({ slug: String(slug || '').toLowerCase(), isActive: true });
}

function serializeMember(item) {
  return {
    role: item.role,
    status: item.status,
    joinedAt: item.joinedAt,
    user: item.user,
  };
}

// GET /check-slug?slug=&name=
export const checkAvailability = async (req, res) => {
  try {
    const rawSlug = typeof req.query.slug === 'string' ? req.query.slug : '';
    const rawName = typeof req.query.name === 'string' ? req.query.name : '';
    const result = { success: true };

    if (rawSlug.trim()) {
      const { slug, error } = validateSlug(slugifyCommunity(rawSlug));
      if (error) {
        result.slug = { value: slug, valid: false, available: false, message: error };
      } else if (await Community.exists({ slug })) {
        const suggestion = await suggestAvailableSlug(slug);
        result.slug = {
          value: slug,
          valid: true,
          available: false,
          message: 'That web address is already taken.',
          suggestion,
        };
      } else {
        result.slug = { value: slug, valid: true, available: true, message: 'Available.' };
      }
    }

    if (rawName.trim()) {
      const name = cleanLine(rawName);
      const existing = name.length >= 3 ? await findCommunityByName(name) : null;
      result.name = {
        value: name,
        available: !existing,
        message: existing ? 'A community with this name already exists.' : '',
      };
    }

    res.json(result);
  } catch (error) {
    console.error('[Community] Availability error:', error);
    res.status(500).json({ success: false, error: 'Could not check availability.' });
  }
};

// PATCH /:slug — owner only. Only the fields present in the body are changed.
export const updateCommunity = async (req, res) => {
  try {
    const community = await loadCommunity(req.params.slug);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    const membership = await getMembership(community._id, req.user.id);
    if (!isOwner(membership)) {
      return res.status(403).json({ success: false, error: 'Only the owner can change community settings.' });
    }

    const { value, errors } = validateCommunityInput(req.body, { partial: true });
    if (typeof req.body?.slug === 'string' && req.body.slug.trim().toLowerCase() !== community.slug) {
      errors.slug = 'The web address cannot be changed after creation, so existing links keep working.';
    }
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, error: Object.values(errors)[0], fields: errors });
    }
    if (!Object.keys(value).length) {
      return res.status(400).json({ success: false, error: 'Nothing to update.' });
    }

    if (value.name && value.name.toLowerCase() !== community.name.toLowerCase()) {
      const taken = await findCommunityByName(value.name, community._id);
      if (taken) {
        return res.status(409).json({
          success: false,
          code: 'NAME_TAKEN',
          error: 'A community with this name already exists.',
          fields: { name: 'A community with this name already exists.' },
        });
      }
    }

    const update = { ...value };
    if (value.ruleItems) update.rules = value.ruleItems.map(rule => rule.title);

    const opening = value.privacy === 'public' && community.privacy !== 'public';
    await Community.updateOne({ _id: community._id }, { $set: update }, { runValidators: true });

    // Opening a community admits everyone who was waiting for approval.
    let approved = 0;
    if (opening) {
      const waiting = await CommunityMember.find({ community: community._id, status: 'pending' })
        .select('_id user').lean();
      if (waiting.length) {
        const result = await CommunityMember.updateMany(
          { _id: { $in: waiting.map(item => item._id) }, status: 'pending' },
          { $set: { status: 'active', joinedAt: new Date() } }
        );
        approved = result.modifiedCount || 0;
        if (approved) {
          await Community.updateOne({ _id: community._id }, { $inc: { memberCount: approved } });
          await notifyUsers(waiting.map(item => item.user), {
            type: 'system',
            title: 'You are in',
            message: `${value.name || community.name} is now open and you are a member`,
            fromUser: req.user.id,
            relatedId: community._id,
            link: `/community/${community.slug}`,
          });
        }
      }
    }

    const fresh = await Community.findById(community._id)
      .populate('owner', AUTHOR_SELECT)
      .populate('moderators', AUTHOR_SELECT)
      .lean();
    res.json({
      success: true,
      approvedRequests: approved,
      community: serializeCommunity(fresh, { membership, joined: true }),
    });
  } catch (error) {
    console.error('[Community] Update error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: 'Some settings are not valid.' });
    }
    res.status(500).json({ success: false, error: 'Could not save community settings.' });
  }
};

// POST /:slug/image/:kind — owner only, multipart field "image".
export const uploadCommunityImage = async (req, res) => {
  try {
    const { kind } = req.params;
    if (!IMAGE_KINDS.includes(kind)) {
      return res.status(400).json({ success: false, error: 'Unknown image type.' });
    }
    const community = await loadCommunity(req.params.slug);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    const membership = await getMembership(community._id, req.user.id);
    if (!isOwner(membership)) {
      return res.status(403).json({ success: false, error: 'Only the owner can change community images.' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, error: 'Choose an image to upload.' });
    }
    // Trust the file's own signature, not the MIME type the client declared.
    const contentType = sniffImageType(req.file.buffer);
    if (!contentType) {
      return res.status(400).json({ success: false, error: 'That file is not a valid JPEG, PNG, WebP or GIF image.' });
    }

    const stored = await CommunityImage.findOneAndUpdate(
      { community: community._id, kind },
      { $set: { data: req.file.buffer, contentType, uploadedBy: req.user.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const url = `/api/community/media/${community._id}/${kind}?v=${stored.updatedAt.getTime()}`;
    const field = kind === 'avatar' ? 'avatar' : 'coverImage';
    await Community.updateOne({ _id: community._id }, { $set: { [field]: url } });

    res.json({ success: true, kind, url });
  } catch (error) {
    console.error('[Community] Image upload error:', error);
    res.status(500).json({ success: false, error: 'Could not upload the image.' });
  }
};

// DELETE /:slug/image/:kind — owner only.
export const removeCommunityImage = async (req, res) => {
  try {
    const { kind } = req.params;
    if (!IMAGE_KINDS.includes(kind)) {
      return res.status(400).json({ success: false, error: 'Unknown image type.' });
    }
    const community = await loadCommunity(req.params.slug);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    const membership = await getMembership(community._id, req.user.id);
    if (!isOwner(membership)) {
      return res.status(403).json({ success: false, error: 'Only the owner can change community images.' });
    }

    const field = kind === 'avatar' ? 'avatar' : 'coverImage';
    await CommunityImage.deleteOne({ community: community._id, kind });
    await Community.updateOne({ _id: community._id }, { $set: { [field]: '' } });
    res.json({ success: true, kind, url: '' });
  } catch (error) {
    console.error('[Community] Image remove error:', error);
    res.status(500).json({ success: false, error: 'Could not remove the image.' });
  }
};

// GET /media/:communityId/:kind — avatar and banner are part of the limited
// preview shown for every community, so they are served without a session.
export const getCommunityImage = async (req, res) => {
  try {
    const { communityId, kind } = req.params;
    if (!/^[a-f\d]{24}$/i.test(communityId) || !IMAGE_KINDS.includes(kind)) {
      return res.status(400).json({ success: false, error: 'Invalid image reference.' });
    }
    const image = await CommunityImage.findOne({ community: communityId, kind })
      .select('data contentType updatedAt');
    if (!image) return res.status(404).json({ success: false, error: 'Image not found.' });

    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Last-Modified': image.updatedAt.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    res.type(image.contentType);
    res.send(image.data);
  } catch (error) {
    console.error('[Community] Image retrieval error:', error);
    res.status(500).json({ success: false, error: 'Could not load the image.' });
  }
};

// GET /:slug/members?status=active|pending|banned
export const listMembers = async (req, res) => {
  try {
    const community = await loadCommunity(req.params.slug);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    const membership = await getMembership(community._id, req.user?.id);
    const staff = isStaff(membership);
    const status = MEMBER_STATUSES.includes(req.query.status) ? req.query.status : 'active';

    if (status !== 'active' && !staff) {
      return res.status(403).json({ success: false, error: 'Only moderators can review requests.' });
    }
    if (!(await canViewCommunity(community, membership))) {
      return res.status(403).json({ success: false, error: 'This community is private.' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 60));
    const filter = { community: community._id, status };
    const [rows, total] = await Promise.all([
      CommunityMember.find(filter)
        .sort({ joinedAt: status === 'active' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', AUTHOR_SELECT)
        .lean(),
      CommunityMember.countDocuments(filter),
    ]);
    const present = rows.filter(item => item.user);

    res.json({
      success: true,
      status,
      page,
      total,
      members: (status === 'active' ? sortMembersByRole(present) : present).map(serializeMember),
    });
  } catch (error) {
    console.error('[Community] Members error:', error);
    res.status(500).json({ success: false, error: 'Could not load members.' });
  }
};

// PATCH /:slug/members/:userId  { action }
// Every change is conditional on the member's current state, so repeating a
// request cannot double-count members or create a second membership.
export const updateMember = async (req, res) => {
  try {
    const action = String(req.body?.action || '');
    const targetId = req.params.userId;
    if (!MEMBER_ACTIONS.includes(action)) {
      return res.status(400).json({ success: false, error: 'Unknown member action.' });
    }
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ success: false, error: 'Invalid member.' });
    }

    const community = await loadCommunity(req.params.slug);
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    const actor = await getMembership(community._id, req.user.id);
    if (!isStaff(actor)) {
      return res.status(403).json({ success: false, error: 'Only the owner and moderators can manage members.' });
    }
    const actorIsOwner = actor.role === 'owner';

    if (String(targetId) === String(req.user.id)) {
      return res.status(400).json({ success: false, error: 'You cannot change your own membership here.' });
    }
    const target = await CommunityMember.findOne({ community: community._id, user: targetId });
    if (!target) {
      return res.status(404).json({ success: false, error: 'That person has no membership or request here.' });
    }
    if (target.role === 'owner' || String(community.owner) === String(targetId)) {
      return res.status(403).json({ success: false, error: 'The owner cannot be changed.' });
    }
    if ((target.role === 'moderator' || ['promote', 'demote'].includes(action)) && !actorIsOwner) {
      return res.status(403).json({ success: false, error: 'Only the owner can manage moderators.' });
    }

    const id = { _id: target._id };
    const dropMember = () => Community.updateOne(
      { _id: community._id },
      { $pull: { moderators: target.user } }
    ).then(() => Community.updateOne(
      { _id: community._id, memberCount: { $gt: 0 } },
      { $inc: { memberCount: -1 } }
    ));
    let changed = false;

    if (action === 'approve') {
      const result = await CommunityMember.updateOne(
        { ...id, status: 'pending' },
        { $set: { status: 'active', role: 'member', joinedAt: new Date() } }
      );
      changed = result.modifiedCount > 0;
      if (changed) {
        await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
        await notifyUsers([target.user], {
          type: 'system',
          title: 'Membership approved',
          message: `You are now a member of ${community.name}`,
          fromUser: req.user.id,
          relatedId: community._id,
          link: `/community/${community.slug}`,
        });
      }
    } else if (action === 'decline') {
      const result = await CommunityMember.deleteOne({ ...id, status: 'pending' });
      changed = result.deletedCount > 0;
    } else if (action === 'remove') {
      const result = await CommunityMember.deleteOne({ ...id, status: 'active' });
      changed = result.deletedCount > 0;
      if (changed) await dropMember();
    } else if (action === 'ban') {
      const before = await CommunityMember.findOneAndUpdate(
        { ...id, status: { $ne: 'banned' } },
        { $set: { status: 'banned', role: 'member' } },
        { new: false }
      );
      changed = Boolean(before);
      if (before?.status === 'active') await dropMember();
    } else if (action === 'unban') {
      // Clears the ban; the person can then join or request again.
      const result = await CommunityMember.deleteOne({ ...id, status: 'banned' });
      changed = result.deletedCount > 0;
    } else if (action === 'promote') {
      const result = await CommunityMember.updateOne(
        { ...id, status: 'active', role: 'member' },
        { $set: { role: 'moderator' } }
      );
      changed = result.modifiedCount > 0;
      if (changed) {
        await Community.updateOne({ _id: community._id }, { $addToSet: { moderators: target.user } });
      } else if (target.status !== 'active') {
        return res.status(400).json({ success: false, error: 'Only approved members can become moderators.' });
      }
    } else if (action === 'demote') {
      const result = await CommunityMember.updateOne(
        { ...id, role: 'moderator' },
        { $set: { role: 'member' } }
      );
      changed = result.modifiedCount > 0;
      if (changed) {
        await Community.updateOne({ _id: community._id }, { $pull: { moderators: target.user } });
      }
    }

    const [member, fresh, pendingRequests] = await Promise.all([
      CommunityMember.findOne({ community: community._id, user: targetId })
        .populate('user', AUTHOR_SELECT).lean(),
      Community.findById(community._id).select('memberCount').lean(),
      CommunityMember.countDocuments({ community: community._id, status: 'pending' }),
    ]);

    res.json({
      success: true,
      action,
      changed,
      member: member && member.user ? serializeMember(member) : null,
      memberCount: fresh?.memberCount || 0,
      pendingRequests,
    });
  } catch (error) {
    console.error('[Community] Member update error:', error);
    res.status(500).json({ success: false, error: 'Could not update that member.' });
  }
};

async function loadPostForModeration(postId, userId) {
  if (!mongoose.Types.ObjectId.isValid(postId)) return { status: 400, error: 'Invalid post id.' };
  const post = await CommunityPost.findById(postId);
  if (!post) return { status: 404, error: 'Post not found.' };
  const membership = await getMembership(post.community, userId);
  return { post, membership };
}

// POST /posts/:postId/lock — owner and moderators.
export const toggleLockPost = async (req, res) => {
  try {
    const { post, membership, status, error } = await loadPostForModeration(req.params.postId, req.user.id);
    if (!post) return res.status(status).json({ success: false, error });
    if (!isStaff(membership)) {
      return res.status(403).json({ success: false, error: 'Only moderators can lock discussions.' });
    }
    post.isLocked = !post.isLocked;
    await post.save();
    res.json({ success: true, isLocked: post.isLocked });
  } catch (error) {
    console.error('[Community] Lock error:', error);
    res.status(500).json({ success: false, error: 'Could not update lock state.' });
  }
};

// DELETE /posts/:postId — the author, the owner or a moderator.
export const deletePost = async (req, res) => {
  try {
    const { post, membership, status, error } = await loadPostForModeration(req.params.postId, req.user.id);
    if (!post) return res.status(status).json({ success: false, error });
    const isAuthor = String(post.author) === String(req.user.id);
    if (!isAuthor && !isStaff(membership)) {
      return res.status(403).json({ success: false, error: 'Only the author or a moderator can delete this discussion.' });
    }

    const removed = await CommunityPost.findOneAndDelete({ _id: post._id });
    if (removed) {
      await Promise.all([
        CommunityComment.deleteMany({ post: post._id }),
        CommunityBookmark.deleteMany({ post: post._id }),
        Community.updateOne(
          { _id: post.community, discussionCount: { $gt: 0 } },
          { $inc: { discussionCount: -1 } }
        ),
      ]);
    }
    res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('[Community] Delete post error:', error);
    res.status(500).json({ success: false, error: 'Could not delete discussion.' });
  }
};
