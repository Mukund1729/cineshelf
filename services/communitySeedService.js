import Community from '../models/Community.js';
import CommunityMember from '../models/CommunityMember.js';
import User from '../models/User.js';

// Curated public societies shown on the Community page.
// Older seeded societies stay in the database; they are only un-featured.
export const FEATURED = [
  {
    name: 'Midnight Screening',
    slug: 'midnight-screening',
    tagline: 'Late-night horror, cult and the films that keep you awake.',
    description: 'Horror, cult and midnight cinema for people who stay for the credits — and the nightmares after.\n\nTalk craft, atmosphere and the titles that refuse to leave the room.',
    category: 'midnight',
    topics: ['horror', 'cult', 'midnight movies'],
    // Hereditary (2018)
    coverImage: 'https://image.tmdb.org/t/p/w1280/pS9Aub8MPyQbENblGD8mHeaqMuv.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/4GFPuL14eXi66V96xBWY73Y9PfR.jpg',
    rules: [
      'Content warnings for graphic material.',
      'No gore for shock alone — discuss craft.',
    ],
  },
  {
    name: 'Rajamouliverse',
    slug: 'rajamouliverse',
    tagline: 'Scale, emotion and the SS Rajamouli cut.',
    description: 'A society for Baahubali, RRR, Eega and every Rajamouli set-piece that feels bigger than the screen.\n\nBreak down the action, the emotion, the music cues and why Telugu mass cinema travels the world.',
    category: 'directors',
    topics: ['rajamouli', 'tollywood', 'rrr', 'baahubali'],
    // RRR (2022) + Rajamouli portrait
    coverImage: 'https://image.tmdb.org/t/p/w1280/i0Y0wP8H6SRgjr6QmuwbtQbS24D.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/qPskSZxvoYflC8Bye4tGNBSroy5.jpg',
    rules: [
      'Spoilers for recent releases stay behind the spoiler toggle.',
      'Argue about craft and scale, not language wars.',
    ],
  },
  {
    name: 'Vanga Room',
    slug: 'vanga-room',
    tagline: 'Rage, romance and Sandeep Reddy Vanga.',
    description: 'Arjun Reddy, Kabir Singh, Animal and the arguments Vanga films force into the open.\n\nTalk performances, score, editing and the line between intensity and excess — without turning the room into a pile-on.',
    category: 'directors',
    topics: ['vanga', 'animal', 'arjun reddy', 'indian cinema'],
    // Animal (2023) + Vanga portrait
    coverImage: 'https://image.tmdb.org/t/p/w1280/lprsAHkwMxk2iC6VZxNmV0H7g1t.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/ik1rXY6ci6i7LDm9cV178W3txgb.jpg',
    rules: [
      'Mark heavy spoilers and violence.',
      'Critique the film; do not attack other members.',
    ],
  },
];

const FEATURED_SLUGS = FEATURED.map(item => item.slug);

function ruleItemsFrom(strings = []) {
  return strings.filter(Boolean).map(title => ({ title, body: '' }));
}

async function resolveOwner() {
  let owner = await User.findOne({ isAdmin: true }).select('_id').lean();
  if (!owner) owner = await User.findOne().sort({ createdAt: 1 }).select('_id').lean();
  return owner;
}

/**
 * Keeps the three curated societies featured and up to date.
 * Does not delete older communities — only clears isFeatured on the rest.
 */
export async function ensureFeaturedCommunities() {
  const owner = await resolveOwner();
  if (!owner) {
    console.warn('[Community] Skip featured seed — no users exist yet.');
    return { seeded: false, count: 0 };
  }

  let created = 0;
  let updated = 0;

  for (const item of FEATURED) {
    const found = await Community.findOne({ slug: item.slug });
    const payload = {
      name: item.name,
      tagline: item.tagline || '',
      description: item.description,
      category: item.category,
      topics: item.topics || [],
      coverImage: item.coverImage,
      avatar: item.avatar,
      rules: item.rules || [],
      ruleItems: ruleItemsFrom(item.rules),
      privacy: 'public',
      isFeatured: true,
      isActive: true,
    };

    if (found) {
      await Community.updateOne({ _id: found._id }, { $set: payload });
      updated += 1;
      continue;
    }

    const community = await Community.create({
      ...payload,
      slug: item.slug,
      owner: owner._id,
      moderators: [owner._id],
      memberCount: 1,
      discussionCount: 0,
      lastActivityAt: new Date(),
    });
    await CommunityMember.updateOne(
      { community: community._id, user: owner._id },
      { $setOnInsert: { role: 'owner', status: 'active', joinedAt: new Date() } },
      { upsert: true }
    );
    created += 1;
  }

  // Older editorial seeds stay in the DB; they just leave the featured rail.
  const unfeature = await Community.updateMany(
    { slug: { $nin: FEATURED_SLUGS }, isFeatured: true },
    { $set: { isFeatured: false } }
  );

  if (created || updated || unfeature.modifiedCount) {
    console.log(
      `[Community] Featured sync — created ${created}, refreshed ${updated}, unfeatured ${unfeature.modifiedCount}.`
    );
  }

  return {
    seeded: created > 0,
    count: created,
    updated,
    unfeatured: unfeature.modifiedCount || 0,
  };
}
