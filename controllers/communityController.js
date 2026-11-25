import mongoose from 'mongoose';
import Community from '../models/Community.js';
import CommunityMember from '../models/CommunityMember.js';
import CommunityPost from '../models/CommunityPost.js';
import CommunityComment from '../models/CommunityComment.js';
import CommunityBookmark from '../models/CommunityBookmark.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { ensureFeaturedCommunities } from '../services/communitySeedService.js';
import { communityCategoryLabel, summarizeCommunityText } from '../data/communityOptions.js';
import {
  escapeRegex,
  isAllowedImageUrl,
  normalizeTopics,
  validateCommunityInput,
} from '../services/communityValidation.js';

export const AUTHOR_SELECT = 'username name avatar bio';
const USERNAME_MENTION_RE = /@([a-zA-Z0-9._-]{3,30})/g;
const ROLE_ORDER = { owner: 0, moderator: 1, member: 2 };
// A repeated create request inside this window returns the community that the
// first request already created instead of failing or creating a second one.
const CREATE_RETRY_WINDOW_MS = 10 * 60 * 1000;
const DUPLICATE_POST_WINDOW_MS = 60 * 1000;

// Structured rules, falling back to the original string rules for communities
// created before `ruleItems` existed.
export function communityRuleItems(doc) {
  if (Array.isArray(doc.ruleItems) && doc.ruleItems.length) {
    return doc.ruleItems.map(rule => ({ _id: rule._id, title: rule.title, body: rule.body || '' }));
  }
  return (doc.rules || []).filter(Boolean).map(rule => ({ title: rule, body: '' }));
}

export function serializeCommunity(community, { membership = null, joined = false } = {}) {
  const doc = community.toObject ? community.toObject() : community;
  const ruleItems = communityRuleItems(doc);
  return {
    _id: doc._id,
    name: doc.name,
    slug: doc.slug,
    tagline: doc.tagline || '',
    description: doc.description,
    summary: doc.tagline || summarizeCommunityText(doc.description),
    category: doc.category,
    categoryLabel: communityCategoryLabel(doc.category),
    topics: doc.topics || [],
    coverImage: doc.coverImage,
    avatar: doc.avatar,
    rules: ruleItems.map(rule => rule.title),
    ruleItems,
    privacy: doc.privacy,
    owner: doc.owner,
    moderators: doc.moderators || [],
    memberCount: doc.memberCount || 0,
    discussionCount: doc.discussionCount || 0,
    isFeatured: Boolean(doc.isFeatured),
    lastActivityAt: doc.lastActivityAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    joined: Boolean(joined || (membership && membership.status === 'active')),
    membershipStatus: membership?.status || null,
    role: membership?.role || null,
  };
}

// What a non-member may see of a community whose content they cannot view:
// enough to recognise it and request to join, nothing from inside it.
export function serializeCommunityPreview(community, membership = null) {
  const doc = community.toObject ? community.toObject() : community;
  return {
    _id: doc._id,
    name: doc.name,
    slug: doc.slug,
    tagline: doc.tagline || '',
    category: doc.category,
    categoryLabel: communityCategoryLabel(doc.category),
    topics: doc.topics || [],
    coverImage: doc.coverImage,
    avatar: doc.avatar,
    privacy: doc.privacy,
    memberCount: doc.memberCount || 0,
    joined: false,
    membershipStatus: membership?.status || null,
    role: null,
  };
}

export function sortMembersByRole(members) {
  return [...members].sort((a, b) => (
    (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
    || new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0)
  ));
}

export function isStaff(membership) {
  return membership?.status === 'active' && ['owner', 'moderator'].includes(membership.role);
}

// Ids of communities whose posts the viewer may read: every public community
// plus the ones they are an approved member of.
async function viewableCommunityIds(userId) {
  const [open, joined] = await Promise.all([
    Community.find({ isActive: true, privacy: 'public' }).select('_id').lean(),
    userId
      ? CommunityMember.find({ user: userId, status: 'active' }).select('community').lean()
      : [],
  ]);
  const ids = new Map(open.map(item => [String(item._id), item._id]));
  for (const item of joined) ids.set(String(item.community), item.community);
  return { all: [...ids.values()], joined: joined.map(item => item.community) };
}

export async function suggestAvailableSlug(base) {
  const root = base.slice(0, 54).replace(/-+$/g, '');
  const candidates = [2, 3, 4, 5, 6, 7, 8, 9].map(n => `${root}-${n}`);
  const taken = new Set((await Community.find({ slug: { $in: candidates } }).select('slug').lean())
    .map(item => item.slug));
  return candidates.find(slug => !taken.has(slug))
    || `${root}-${Date.now().toString(36).slice(-4)}`;
}

export function findCommunityByName(name, excludeId = null) {
  const filter = { name: new RegExp(`^${escapeRegex(name)}$`, 'i') };
  if (excludeId) filter._id = { $ne: excludeId };
  return Community.findOne(filter).select('_id name slug owner privacy createdAt');
}

function reactionCounts(reactions = {}) {
  return {
    clap: reactions.clap?.length || 0,
    fire: reactions.fire?.length || 0,
    think: reactions.think?.length || 0,
    heart: reactions.heart?.length || 0,
  };
}

function serializePost(post, { bookmarked = false, userId = null } = {}) {
  const doc = post.toObject ? post.toObject() : post;
  const myReactions = {};
  if (userId) {
    for (const key of ['clap', 'fire', 'think', 'heart']) {
      myReactions[key] = Boolean(doc.reactions?.[key]?.some(id => String(id) === String(userId)));
    }
  }
  return {
    _id: doc._id,
    community: doc.community,
    author: doc.author,
    type: doc.type,
    title: doc.title,
    body: doc.body,
    spoiler: Boolean(doc.spoiler),
    images: doc.images || [],
    movie: doc.movie || null,
    poll: doc.poll ? {
      question: doc.poll.question,
      endsAt: doc.poll.endsAt,
      options: (doc.poll.options || []).map(option => ({
        _id: option._id,
        text: option.text,
        voteCount: option.votes?.length || 0,
        voted: userId ? option.votes?.some(id => String(id) === String(userId)) : false,
      })),
    } : null,
    reactionCounts: reactionCounts(doc.reactions),
    myReactions,
    commentCount: doc.commentCount || 0,
    bookmarkCount: doc.bookmarkCount || 0,
    bookmarked,
    isPinned: Boolean(doc.isPinned),
    isLocked: Boolean(doc.isLocked),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function resolveMentions(text) {
  const names = [...String(text || '').matchAll(USERNAME_MENTION_RE)].map(match => match[1]);
  if (!names.length) return [];
  const users = await User.find({ username: { $in: names } }).select('_id username').lean();
  return users.map(user => user._id);
}

export async function notifyUsers(userIds, payload) {
  const unique = [...new Set(userIds.map(String))].filter(Boolean);
  if (!unique.length) return;
  await Notification.insertMany(
    unique.map(userId => ({
      user: userId,
      ...payload,
    })),
    { ordered: false }
  ).catch(error => console.warn('[Community] Notification write failed:', error.message));
}

export async function getMembership(communityId, userId) {
  if (!userId) return null;
  return CommunityMember.findOne({ community: communityId, user: userId }).lean();
}

export async function canViewCommunity(community, membership) {
  if (community.privacy === 'public') return true;
  return membership?.status === 'active';
}

// Loads a post for an interaction (react, vote, bookmark) and confirms the
// viewer is allowed to see the community it belongs to.
async function loadViewablePost(postId, userId) {
  if (!mongoose.Types.ObjectId.isValid(postId)) return { status: 400, error: 'Invalid post id.' };
  const post = await CommunityPost.findById(postId);
  if (!post) return { status: 404, error: 'Post not found.' };
  const community = await Community.findById(post.community).select('privacy isActive').lean();
  if (!community || community.isActive === false) return { status: 404, error: 'Post not found.' };
  const membership = await getMembership(community._id, userId);
  if (membership?.status === 'banned' || !(await canViewCommunity(community, membership))) {
    return { status: 403, error: 'This discussion is private.' };
  }
  return { post };
}

async function canPost(community, membership) {
  if (!membership || membership.status !== 'active') return false;
  if (community.privacy === 'restricted' && !['owner', 'moderator'].includes(membership.role)) {
    return membership.role === 'member'; // restricted: members can post; non-members cannot join freely
  }
  return true;
}

export const getCommunityHome = async (req, res) => {
  try {
    await ensureFeaturedCommunities();
    const userId = req.user?.id || null;

    const [
      totalCommunities,
      totalMembers,
      totalDiscussions,
      activeCommunities,
      featured,
      trending,
    ] = await Promise.all([
      Community.countDocuments({ isActive: true }),
      CommunityMember.countDocuments({ status: 'active' }),
      CommunityPost.countDocuments({}),
      Community.countDocuments({
        isActive: true,
        lastActivityAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      }),
      // Private communities never appear in discovery rails.
      Community.find({ isActive: true, isFeatured: true, privacy: { $ne: 'private' } })
        .sort({ memberCount: -1 }).limit(8).lean(),
      Community.find({ isActive: true, privacy: { $ne: 'private' } })
        .sort({ lastActivityAt: -1, memberCount: -1 }).limit(8).lean(),
    ]);

    // Every membership record (so cards can show "Requested"); only approved
    // ones count as joined.
    const allMemberships = userId
      ? await CommunityMember.find({ user: userId }).lean()
      : [];
    const memberships = allMemberships.filter(item => item.status === 'active');
    const joinedIds = new Set(memberships.map(item => String(item.community)));

    let yourCommunities = [];
    let createdCommunities = [];
    let circlePosts = [];
    if (userId) {
      const joinedCommunityIds = [...joinedIds];
      [yourCommunities, createdCommunities, circlePosts] = await Promise.all([
        Community.find({ _id: { $in: joinedCommunityIds }, isActive: true })
          .sort({ lastActivityAt: -1 })
          .limit(12)
          .lean(),
        Community.find({ owner: userId, isActive: true }).sort({ createdAt: -1 }).limit(8).lean(),
        joinedCommunityIds.length
          ? CommunityPost.find({ community: { $in: joinedCommunityIds } })
            .sort({ createdAt: -1 })
            .limit(8)
            .populate('author', AUTHOR_SELECT)
            .populate('community', 'name slug avatar')
            .lean()
          : Promise.resolve([]),
      ]);
    }

    const mapWithJoin = list => list.map(item => serializeCommunity(item, {
      joined: joinedIds.has(String(item._id)),
      membership: allMemberships.find(m => String(m.community) === String(item._id)),
    }));

    const bookmarkIds = userId && circlePosts.length
      ? new Set((await CommunityBookmark.find({
        user: userId,
        post: { $in: circlePosts.map(post => post._id) },
      }).select('post').lean()).map(item => String(item.post)))
      : new Set();

    res.json({
      success: true,
      stats: {
        totalCommunities,
        totalMembers,
        totalDiscussions,
        activeCommunities,
      },
      featured: mapWithJoin(featured),
      trending: mapWithJoin(trending),
      circle: userId ? {
        joined: mapWithJoin(yourCommunities),
        created: mapWithJoin(createdCommunities),
        recentPosts: circlePosts.map(post => serializePost(post, {
          userId,
          bookmarked: bookmarkIds.has(String(post._id)),
        })),
      } : null,
    });
  } catch (error) {
    console.error('[Community] Home error:', error);
    res.status(500).json({ success: false, error: 'Could not load community home.' });
  }
};

export const listCommunities = async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 20));
    const topic = normalizeTopics([typeof req.query.topic === 'string' ? req.query.topic : '']).topics[0] || '';
    // Private communities are never listed or searchable.
    const base = { isActive: true, privacy: { $ne: 'private' } };
    const filter = { ...base };
    if (category) filter.category = category;
    if (topic) filter.topics = topic;
    if (q) {
      // Escaped, case-insensitive partial match so "nol" finds "The Nolanverse".
      const pattern = new RegExp(escapeRegex(q.slice(0, 60)), 'i');
      filter.$or = [{ name: pattern }, { tagline: pattern }, { topics: pattern }, { description: pattern }];
    }

    const [rows, total, categoryFacets, topicFacets] = await Promise.all([
      Community.find(filter)
        .sort({ memberCount: -1, lastActivityAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Community.countDocuments(filter),
      // Filter options come from the communities that actually exist.
      Community.aggregate([
        { $match: base },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Community.aggregate([
        { $match: base },
        { $unwind: '$topics' },
        { $group: { _id: '$topics', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 16 },
      ]),
    ]);

    const userId = req.user?.id;
    const memberships = userId
      ? await CommunityMember.find({
        user: userId,
        community: { $in: rows.map(row => row._id) },
      }).lean()
      : [];
    const byCommunity = new Map(memberships.map(item => [String(item.community), item]));

    res.json({
      success: true,
      page,
      limit,
      total,
      communities: rows.map(row => serializeCommunity(row, {
        membership: byCommunity.get(String(row._id)),
        joined: byCommunity.get(String(row._id))?.status === 'active',
      })),
      facets: {
        categories: categoryFacets.map(item => ({
          key: item._id,
          label: communityCategoryLabel(item._id),
          count: item.count,
        })),
        topics: topicFacets.map(item => ({ key: item._id, count: item.count })),
      },
    });
  } catch (error) {
    console.error('[Community] List error:', error);
    res.status(500).json({ success: false, error: 'Could not list communities.' });
  }
};

export const createCommunity = async (req, res) => {
  try {
    const { value, errors } = validateCommunityInput(req.body);
    const images = {};
    for (const field of ['coverImage', 'avatar']) {
      const image = typeof req.body?.[field] === 'string' ? req.body[field].trim() : '';
      if (!isAllowedImageUrl(image)) errors[field] = 'Image links must be https addresses.';
      images[field] = image;
    }
    if (Object.keys(errors).length) {
      return res.status(400).json({
        success: false,
        error: Object.values(errors)[0],
        fields: errors,
      });
    }

    const ownerMembership = { role: 'owner', status: 'active' };
    const isRetryOf = existing => existing
      && String(existing.owner) === String(req.user.id)
      && existing.name.toLowerCase() === value.name.toLowerCase()
      && Date.now() - new Date(existing.createdAt).getTime() < CREATE_RETRY_WINDOW_MS;
    const respondWithExisting = async existing => {
      // Same creator repeating the same request: make sure the owner membership
      // exists exactly once and hand back the community already created.
      await CommunityMember.updateOne(
        { community: existing._id, user: req.user.id },
        { $setOnInsert: { ...ownerMembership, joinedAt: new Date() } },
        { upsert: true }
      );
      const community = await Community.findById(existing._id);
      return res.status(200).json({
        success: true,
        existing: true,
        community: serializeCommunity(community, { joined: true, membership: ownerMembership }),
      });
    };

    const [slugOwner, nameOwner] = await Promise.all([
      Community.findOne({ slug: value.slug }).select('_id name slug owner createdAt'),
      findCommunityByName(value.name),
    ]);
    if (isRetryOf(slugOwner)) return await respondWithExisting(slugOwner);
    if (nameOwner) {
      return res.status(409).json({
        success: false,
        code: 'NAME_TAKEN',
        error: `A community named “${nameOwner.name}” already exists.`,
        fields: { name: 'A community with this name already exists. Try a more specific name.' },
        // Never point at a private community.
        existingSlug: nameOwner.privacy === 'private' ? null : nameOwner.slug,
      });
    }
    if (slugOwner) {
      const suggestion = await suggestAvailableSlug(value.slug);
      return res.status(409).json({
        success: false,
        code: 'SLUG_TAKEN',
        error: 'That web address is already taken.',
        fields: { slug: `That web address is taken. “${suggestion}” is available.` },
        suggestion,
      });
    }

    let community;
    try {
      community = await Community.create({
        ...value,
        // Original string rules stay in sync with the structured rule titles.
        rules: value.ruleItems.map(rule => rule.title),
        coverImage: images.coverImage,
        avatar: images.avatar,
        owner: req.user.id,
        moderators: [req.user.id],
        memberCount: 1,
        isFeatured: false,
        lastActivityAt: new Date(),
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Lost a race for the slug. If our own parallel request won, reuse it.
      const winner = await Community.findOne({ slug: value.slug }).select('_id name slug owner createdAt');
      if (isRetryOf(winner)) return await respondWithExisting(winner);
      const suggestion = await suggestAvailableSlug(value.slug);
      return res.status(409).json({
        success: false,
        code: 'SLUG_TAKEN',
        error: 'That web address is already taken.',
        fields: { slug: `That web address is taken. “${suggestion}” is available.` },
        suggestion,
      });
    }

    try {
      await CommunityMember.updateOne(
        { community: community._id, user: req.user.id },
        { $setOnInsert: { ...ownerMembership, joinedAt: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      // Never leave a community without its owner membership.
      await Community.deleteOne({ _id: community._id }).catch(() => {});
      throw error;
    }

    res.status(201).json({
      success: true,
      community: serializeCommunity(community, { joined: true, membership: ownerMembership }),
    });
  } catch (error) {
    console.error('[Community] Create error:', error);
    res.status(500).json({ success: false, error: 'Could not create community.' });
  }
};

export const getCommunityBySlug = async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isActive: true })
      .populate('owner', AUTHOR_SELECT)
      .populate('moderators', AUTHOR_SELECT)
      .lean();
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });

    const membership = await getMembership(community._id, req.user?.id);
    if (!(await canViewCommunity(community, membership))) {
      // Same 403 as before, plus a limited preview so the page can offer
      // "request to join". Nothing from inside the community is included.
      return res.status(403).json({
        success: false,
        code: membership?.status === 'banned' ? 'BANNED' : 'MEMBERS_ONLY',
        error: 'This community is private.',
        preview: serializeCommunityPreview(community, membership),
      });
    }

    const staff = isStaff(membership);
    const [memberRows, pendingCount] = await Promise.all([
      CommunityMember.find({ community: community._id, status: 'active' })
        .sort({ joinedAt: 1 })
        .limit(200)
        .populate('user', AUTHOR_SELECT)
        .lean(),
      staff ? CommunityMember.countDocuments({ community: community._id, status: 'pending' }) : 0,
    ]);
    // Owner first, then moderators, then members (a plain sort on `role` is
    // alphabetical and would put the owner last).
    const members = sortMembersByRole(memberRows.filter(item => item.user)).slice(0, 48);

    const mediaPosts = await CommunityPost.find({
      community: community._id,
      $or: [{ images: { $exists: true, $ne: [] } }, { 'movie.posterPath': { $ne: '' } }],
    })
      .sort({ createdAt: -1 })
      .limit(24)
      .select('images movie title createdAt')
      .lean();

    res.json({
      success: true,
      community: serializeCommunity(community, {
        membership,
        joined: membership?.status === 'active',
      }),
      viewer: {
        isOwner: staff && membership.role === 'owner',
        canManage: staff,
        pendingRequests: pendingCount,
      },
      members: members.map(item => ({
        role: item.role,
        joinedAt: item.joinedAt,
        user: item.user,
      })),
      media: mediaPosts.flatMap(post => {
        const items = (post.images || []).map(url => ({ type: 'image', url, postId: post._id, title: post.title }));
        if (post.movie?.posterPath) {
          items.push({
            type: 'poster',
            url: post.movie.posterPath.startsWith('http')
              ? post.movie.posterPath
              : `https://image.tmdb.org/t/p/w500${post.movie.posterPath}`,
            postId: post._id,
            title: post.movie.title || post.title,
          });
        }
        return items;
      }).slice(0, 36),
    });
  } catch (error) {
    console.error('[Community] Detail error:', error);
    res.status(500).json({ success: false, error: 'Could not load community.' });
  }
};

export const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isActive: true });
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });

    // Private and restricted communities admit members by approval.
    const needsApproval = community.privacy !== 'public';
    const existing = await CommunityMember.findOne({ community: community._id, user: req.user.id });
    if (existing?.status === 'active') {
      return res.json({ success: true, joined: true, community: serializeCommunity(community, { joined: true, membership: existing }) });
    }
    if (existing?.status === 'banned') {
      return res.status(403).json({ success: false, error: 'You cannot join this community.' });
    }
    if (existing?.status === 'pending' && needsApproval) {
      // Repeated request: nothing to change, no second notification.
      return res.json({
        success: true,
        joined: false,
        pending: true,
        community: serializeCommunityPreview(community, existing),
      });
    }

    const status = needsApproval ? 'pending' : 'active';
    // The unique (community, user) index guarantees a single membership record.
    const before = await CommunityMember.findOneAndUpdate(
      { community: community._id, user: req.user.id, status: { $ne: 'banned' } },
      {
        $set: {
          role: 'member',
          status,
          joinedAt: new Date(),
        },
      },
      { upsert: true, new: false }
    );
    const membership = { role: 'member', status };

    // Count the member only when this request is the one that activated them.
    if (status === 'active' && before?.status !== 'active') {
      await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 }, $set: { lastActivityAt: new Date() } });
      community.memberCount += 1;
    }

    if (status === 'pending' && !before) {
      const staff = await CommunityMember.find({
        community: community._id,
        status: 'active',
        role: { $in: ['owner', 'moderator'] },
      }).select('user').lean();
      await notifyUsers(staff.map(item => item.user), {
        type: 'system',
        title: 'New membership request',
        message: `Someone asked to join ${community.name}`,
        fromUser: req.user.id,
        relatedId: community._id,
        link: `/community/${community.slug}/settings?tab=requests`,
      });
    }

    res.json({
      success: true,
      joined: status === 'active',
      pending: status === 'pending',
      community: status === 'active'
        ? serializeCommunity(community, { membership, joined: true })
        : serializeCommunityPreview(community, membership),
    });
  } catch (error) {
    console.error('[Community] Join error:', error);
    if (error.code === 11000) {
      // Two requests raced on the unique membership index; the record exists.
      return res.status(409).json({ success: false, error: 'Your membership is being updated. Please try again.' });
    }
    res.status(500).json({ success: false, error: 'Could not join community.' });
  }
};

export const leaveCommunity = async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isActive: true });
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    if (String(community.owner) === String(req.user.id)) {
      return res.status(400).json({ success: false, error: 'Owners cannot leave. Transfer ownership first.' });
    }

    const membership = await CommunityMember.findOneAndDelete({
      community: community._id,
      user: req.user.id,
      status: { $in: ['active', 'pending'] },
    });
    if (!membership) return res.status(404).json({ success: false, error: 'You are not a member.' });

    if (membership.status === 'active') {
      await Community.updateOne(
        { _id: community._id, memberCount: { $gt: 0 } },
        { $inc: { memberCount: -1 }, $pull: { moderators: req.user.id } }
      );
    }

    res.json({ success: true, joined: false });
  } catch (error) {
    console.error('[Community] Leave error:', error);
    res.status(500).json({ success: false, error: 'Could not leave community.' });
  }
};

export const getFeed = async (req, res) => {
  try {
    const filterKey = typeof req.query.filter === 'string' ? req.query.filter : 'latest';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 20));
    const userId = req.user?.id || null;

    // Posts from public communities plus the ones the viewer is an approved
    // member of. Members-only communities never reach anyone else's feed.
    const viewable = await viewableCommunityIds(userId);
    const communityIds = filterKey === 'following' && userId ? viewable.joined : viewable.all;

    const query = { community: { $in: communityIds } };
    let sort = { createdAt: -1 };
    if (filterKey === 'trending') {
      sort = { commentCount: -1, createdAt: -1 };
    }

    const [rows, total] = await Promise.all([
      CommunityPost.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', AUTHOR_SELECT)
        .populate('community', 'name slug avatar')
        .lean(),
      CommunityPost.countDocuments(query),
    ]);

    const bookmarks = userId
      ? new Set((await CommunityBookmark.find({
        user: userId,
        post: { $in: rows.map(row => row._id) },
      }).select('post').lean()).map(item => String(item.post)))
      : new Set();

    res.json({
      success: true,
      page,
      total,
      posts: rows.map(post => serializePost(post, {
        userId,
        bookmarked: bookmarks.has(String(post._id)),
      })),
    });
  } catch (error) {
    console.error('[Community] Feed error:', error);
    res.status(500).json({ success: false, error: 'Could not load discussion feed.' });
  }
};

export const getCommunityPosts = async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isActive: true }).lean();
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    const membership = await getMembership(community._id, req.user?.id);
    if (!(await canViewCommunity(community, membership))) {
      return res.status(403).json({ success: false, error: 'This community is private.' });
    }

    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'latest';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 20));
    const filter = { community: community._id };
    let sort = { isPinned: -1, createdAt: -1 };
    if (tab === 'trending') sort = { isPinned: -1, commentCount: -1, createdAt: -1 };
    if (tab === 'questions') filter.type = 'question';
    if (tab === 'polls') filter.type = 'poll';
    if (tab === 'pinned') filter.isPinned = true;

    const [rows, total] = await Promise.all([
      CommunityPost.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', AUTHOR_SELECT)
        .lean(),
      CommunityPost.countDocuments(filter),
    ]);

    const bookmarks = req.user?.id
      ? new Set((await CommunityBookmark.find({
        user: req.user.id,
        post: { $in: rows.map(row => row._id) },
      }).select('post').lean()).map(item => String(item.post)))
      : new Set();

    res.json({
      success: true,
      page,
      total,
      posts: rows.map(post => serializePost({ ...post, community }, {
        userId: req.user?.id,
        bookmarked: bookmarks.has(String(post._id)),
      })),
    });
  } catch (error) {
    console.error('[Community] Posts error:', error);
    res.status(500).json({ success: false, error: 'Could not load discussions.' });
  }
};

export const createPost = async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isActive: true });
    if (!community) return res.status(404).json({ success: false, error: 'Community not found.' });
    const membership = await getMembership(community._id, req.user.id);
    if (!(await canPost(community, membership))) {
      return res.status(403).json({ success: false, error: 'Join this community to post.' });
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    const type = [
      'discussion', 'question', 'theory', 'poll', 'recommendation', 'image', 'announcement',
    ].includes(req.body.type) ? req.body.type : 'discussion';

    if (title.length < 4 || title.length > 160) {
      return res.status(400).json({ success: false, error: 'Title must be 4–160 characters.' });
    }
    if (body.length < 1 || body.length > 8000) {
      return res.status(400).json({ success: false, error: 'Post body is required (max 8000 characters).' });
    }
    if (type === 'announcement' && !['owner', 'moderator'].includes(membership.role)) {
      return res.status(403).json({ success: false, error: 'Only moderators can post announcements.' });
    }

    const movie = req.body.movie && Number(req.body.movie.tmdbId) > 0 ? {
      tmdbId: Number(req.body.movie.tmdbId),
      title: String(req.body.movie.title || '').slice(0, 160),
      posterPath: String(req.body.movie.posterPath || ''),
      backdropPath: String(req.body.movie.backdropPath || ''),
      releaseYear: Number(req.body.movie.releaseYear) || null,
    } : undefined;

    let poll;
    if (type === 'poll') {
      const options = Array.isArray(req.body.poll?.options)
        ? req.body.poll.options.map(text => String(text).trim()).filter(Boolean).slice(0, 6)
        : [];
      if (options.length < 2) {
        return res.status(400).json({ success: false, error: 'Polls need at least two options.' });
      }
      poll = {
        question: String(req.body.poll?.question || title).slice(0, 160),
        options: options.map(text => ({ text, votes: [] })),
      };
    }

    // A repeated submit (double click, retry after a dropped response) returns
    // the post that already exists instead of publishing it twice.
    const duplicate = await CommunityPost.findOne({
      community: community._id,
      author: req.user.id,
      title,
      body,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_POST_WINDOW_MS) },
    })
      .populate('author', AUTHOR_SELECT)
      .populate('community', 'name slug avatar')
      .lean();
    if (duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        post: serializePost(duplicate, { userId: req.user.id }),
      });
    }

    const mentions = await resolveMentions(`${title}\n${body}`);
    const post = await CommunityPost.create({
      community: community._id,
      author: req.user.id,
      type,
      title,
      body,
      spoiler: Boolean(req.body.spoiler),
      images: Array.isArray(req.body.images) ? req.body.images.map(String).slice(0, 6) : [],
      movie,
      poll,
      mentions,
    });

    await Community.updateOne(
      { _id: community._id },
      { $inc: { discussionCount: 1 }, $set: { lastActivityAt: new Date() } }
    );

    const populated = await CommunityPost.findById(post._id)
      .populate('author', AUTHOR_SELECT)
      .populate('community', 'name slug avatar')
      .lean();

    await notifyUsers(
      mentions.filter(id => String(id) !== String(req.user.id)),
      {
        type: 'community_mention',
        title: 'You were mentioned',
        message: `You were mentioned in ${community.name}`,
        fromUser: req.user.id,
        relatedId: post._id,
        link: `/community/${community.slug}?post=${post._id}`,
      }
    );

    res.status(201).json({
      success: true,
      post: serializePost(populated, { userId: req.user.id }),
    });
  } catch (error) {
    console.error('[Community] Create post error:', error);
    res.status(500).json({ success: false, error: 'Could not create discussion.' });
  }
};

export const getPost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post id.' });
    }
    const post = await CommunityPost.findById(req.params.postId)
      .populate('author', AUTHOR_SELECT)
      .populate('community', 'name slug avatar privacy owner')
      .lean();
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });

    const membership = await getMembership(post.community._id || post.community, req.user?.id);
    if (!(await canViewCommunity(post.community, membership))) {
      return res.status(403).json({ success: false, error: 'This discussion is private.' });
    }

    const [comments, bookmarked] = await Promise.all([
      CommunityComment.find({ post: post._id })
        .sort({ createdAt: 1 })
        .populate('author', AUTHOR_SELECT)
        .lean(),
      req.user?.id
        ? CommunityBookmark.exists({ user: req.user.id, post: post._id })
        : false,
    ]);

    const staff = isStaff(membership);
    res.json({
      success: true,
      post: serializePost(post, { userId: req.user?.id, bookmarked: Boolean(bookmarked) }),
      viewer: {
        canModerate: staff,
        canDelete: staff || (Boolean(req.user?.id) && String(post.author?._id || post.author) === String(req.user.id)),
      },
      comments: comments.map(comment => ({
        _id: comment._id,
        author: comment.author,
        parent: comment.parent,
        body: comment.body,
        spoiler: comment.spoiler,
        createdAt: comment.createdAt,
        reactionCounts: {
          clap: comment.reactions?.clap?.length || 0,
          heart: comment.reactions?.heart?.length || 0,
        },
      })),
    });
  } catch (error) {
    console.error('[Community] Get post error:', error);
    res.status(500).json({ success: false, error: 'Could not load discussion.' });
  }
};

export const reactToPost = async (req, res) => {
  try {
    const reaction = String(req.body.reaction || '');
    if (!['clap', 'fire', 'think', 'heart'].includes(reaction)) {
      return res.status(400).json({ success: false, error: 'Invalid reaction.' });
    }
    const { post, status, error } = await loadViewablePost(req.params.postId, req.user.id);
    if (!post) return res.status(status).json({ success: false, error });

    const list = post.reactions[reaction] || [];
    const idx = list.findIndex(id => String(id) === String(req.user.id));
    if (idx >= 0) list.splice(idx, 1);
    else list.push(req.user.id);
    post.reactions[reaction] = list;
    await post.save();

    res.json({ success: true, reactionCounts: reactionCounts(post.reactions) });
  } catch (error) {
    console.error('[Community] React error:', error);
    res.status(500).json({ success: false, error: 'Could not update reaction.' });
  }
};

export const votePoll = async (req, res) => {
  try {
    const optionId = req.body.optionId;
    const { post, status, error } = await loadViewablePost(req.params.postId, req.user.id);
    if (!post) return res.status(status).json({ success: false, error });
    if (post.type !== 'poll') {
      return res.status(404).json({ success: false, error: 'Poll not found.' });
    }
    const option = post.poll.options.id(optionId);
    if (!option) return res.status(400).json({ success: false, error: 'Invalid poll option.' });

    for (const entry of post.poll.options) {
      entry.votes = entry.votes.filter(id => String(id) !== String(req.user.id));
    }
    option.votes.push(req.user.id);
    await post.save();

    res.json({
      success: true,
      poll: {
        question: post.poll.question,
        options: post.poll.options.map(item => ({
          _id: item._id,
          text: item.text,
          voteCount: item.votes.length,
          voted: item.votes.some(id => String(id) === String(req.user.id)),
        })),
      },
    });
  } catch (error) {
    console.error('[Community] Poll vote error:', error);
    res.status(500).json({ success: false, error: 'Could not record vote.' });
  }
};

export const toggleBookmark = async (req, res) => {
  try {
    const { post, status, error } = await loadViewablePost(req.params.postId, req.user.id);
    if (!post) return res.status(status).json({ success: false, error });

    const existing = await CommunityBookmark.findOne({ user: req.user.id, post: post._id });
    if (existing) {
      await existing.deleteOne();
      await CommunityPost.updateOne(
        { _id: post._id, bookmarkCount: { $gt: 0 } },
        { $inc: { bookmarkCount: -1 } }
      );
      return res.json({ success: true, bookmarked: false });
    }

    await CommunityBookmark.create({ user: req.user.id, post: post._id });
    await CommunityPost.updateOne({ _id: post._id }, { $inc: { bookmarkCount: 1 } });
    res.json({ success: true, bookmarked: true });
  } catch (error) {
    console.error('[Community] Bookmark error:', error);
    res.status(500).json({ success: false, error: 'Could not update bookmark.' });
  }
};

export const addComment = async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.postId).populate('community');
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });
    if (post.isLocked) return res.status(403).json({ success: false, error: 'This discussion is locked.' });

    const membership = await getMembership(post.community._id || post.community, req.user.id);
    if (!(await canPost(post.community, membership))) {
      return res.status(403).json({ success: false, error: 'Join the community to comment.' });
    }

    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body || body.length > 3000) {
      return res.status(400).json({ success: false, error: 'Comment must be 1–3000 characters.' });
    }

    const parent = req.body.parent && mongoose.Types.ObjectId.isValid(req.body.parent)
      ? req.body.parent
      : null;
    if (parent) {
      const parentComment = await CommunityComment.findOne({ _id: parent, post: post._id });
      if (!parentComment) return res.status(400).json({ success: false, error: 'Parent comment not found.' });
    }

    const mentions = await resolveMentions(body);
    const comment = await CommunityComment.create({
      post: post._id,
      community: post.community._id || post.community,
      author: req.user.id,
      parent,
      body,
      spoiler: Boolean(req.body.spoiler),
      mentions,
    });
    await CommunityPost.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
    await Community.updateOne(
      { _id: post.community._id || post.community },
      { $set: { lastActivityAt: new Date() } }
    );

    const populated = await CommunityComment.findById(comment._id).populate('author', AUTHOR_SELECT).lean();
    const notifyTargets = [
      ...mentions.map(String),
      String(post.author),
    ].filter(id => id !== String(req.user.id));

    await notifyUsers(notifyTargets, {
      type: mentions.length ? 'community_mention' : 'community_comment',
      title: mentions.length ? 'You were mentioned' : 'New comment',
      message: `New activity on “${post.title}”`,
      fromUser: req.user.id,
      relatedId: post._id,
      link: `/community/${post.community.slug || ''}?post=${post._id}`,
    });

    res.status(201).json({
      success: true,
      comment: {
        _id: populated._id,
        author: populated.author,
        parent: populated.parent,
        body: populated.body,
        spoiler: populated.spoiler,
        createdAt: populated.createdAt,
        reactionCounts: { clap: 0, heart: 0 },
      },
    });
  } catch (error) {
    console.error('[Community] Comment error:', error);
    res.status(500).json({ success: false, error: 'Could not add comment.' });
  }
};

export const pinPost = async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.postId).populate('community');
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });
    const membership = await getMembership(post.community._id || post.community, req.user.id);
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      return res.status(403).json({ success: false, error: 'Only moderators can pin discussions.' });
    }
    post.isPinned = !post.isPinned;
    await post.save();
    res.json({ success: true, isPinned: post.isPinned });
  } catch (error) {
    console.error('[Community] Pin error:', error);
    res.status(500).json({ success: false, error: 'Could not update pin state.' });
  }
};

export const getMovieSpotlight = async (req, res) => {
  try {
    // Only discussions the viewer is allowed to read feed the spotlight.
    const viewable = await viewableCommunityIds(req.user?.id);
    const pipeline = [
      { $match: { 'movie.tmdbId': { $ne: null }, community: { $in: viewable.all } } },
      {
        $group: {
          _id: '$movie.tmdbId',
          title: { $first: '$movie.title' },
          posterPath: { $first: '$movie.posterPath' },
          backdropPath: { $first: '$movie.backdropPath' },
          releaseYear: { $first: '$movie.releaseYear' },
          discussionCount: { $sum: 1 },
          latestAt: { $max: '$createdAt' },
        },
      },
      { $sort: { discussionCount: -1, latestAt: -1 } },
      { $limit: 1 },
    ];
    const [spotlight] = await CommunityPost.aggregate(pipeline);
    if (!spotlight) {
      return res.json({ success: true, spotlight: null, posts: [] });
    }

    const posts = await CommunityPost.find({ 'movie.tmdbId': spotlight._id, community: { $in: viewable.all } })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('author', AUTHOR_SELECT)
      .populate('community', 'name slug')
      .lean();

    res.json({
      success: true,
      spotlight: {
        tmdbId: spotlight._id,
        title: spotlight.title,
        posterPath: spotlight.posterPath,
        backdropPath: spotlight.backdropPath,
        releaseYear: spotlight.releaseYear,
        discussionCount: spotlight.discussionCount,
      },
      posts: posts.map(post => serializePost(post, { userId: req.user?.id })),
    });
  } catch (error) {
    console.error('[Community] Spotlight error:', error);
    res.status(500).json({ success: false, error: 'Could not load movie spotlight.' });
  }
};

export const getUserCommunities = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user.' });
    }
    const memberships = await CommunityMember.find({ user: userId, status: 'active' })
      .sort({ joinedAt: -1 })
      .limit(40)
      .populate('community')
      .lean();

    // On someone else's profile, private memberships are shown only to people
    // who are approved members of that same community.
    const viewerId = req.user?.id || null;
    const isSelf = Boolean(viewerId) && String(viewerId) === String(userId);
    const active = memberships.filter(item => item.community && item.community.isActive !== false);
    const privateIds = active
      .filter(item => item.community.privacy === 'private')
      .map(item => item.community._id);
    const shared = !isSelf && viewerId && privateIds.length
      ? new Set((await CommunityMember.find({
        user: viewerId,
        status: 'active',
        community: { $in: privateIds },
      }).select('community').lean()).map(item => String(item.community)))
      : new Set();
    const visible = active.filter(item => (
      isSelf
      || item.community.privacy !== 'private'
      || shared.has(String(item.community._id))
    ));

    res.json({
      success: true,
      // `joined` / `role` describe the profile's user, as before.
      communities: visible.map(item => serializeCommunity(item.community, {
        joined: true,
        membership: { role: item.role, status: item.status },
      })),
    });
  } catch (error) {
    console.error('[Community] User communities error:', error);
    res.status(500).json({ success: false, error: 'Could not load user communities.' });
  }
};
