import Community from '../models/Community.js';
import CommunityMember from '../models/CommunityMember.js';
import User from '../models/User.js';

const FEATURED = [
  {
    name: 'The Nolanverse',
    slug: 'the-nolanverse',
    description: 'Chronology, craft and cold geometry — a salon for Nolan devotees.',
    category: 'auteur',
    coverImage: 'https://image.tmdb.org/t/p/w1280/rAiYTfKGqDCR3uUW01hBObAvzCS.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg',
    rules: ['Mark spoilers clearly.', 'Argue with evidence, not insults.', 'Keep posts about Nolan’s filmography and craft.'],
  },
  {
    name: 'Indian Frames',
    slug: 'indian-frames',
    description: 'From parallel cinema to contemporary blockbusters — India’s moving image culture.',
    category: 'regional',
    coverImage: 'https://image.tmdb.org/t/p/w1280/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    rules: ['Respect language diversity.', 'Credit regional industries fairly.', 'Spoilers behind the veil.'],
  },
  {
    name: 'Beyond the Frame',
    slug: 'beyond-the-frame',
    description: 'Form, theory and criticism for people who watch with a notebook open.',
    category: 'theory',
    coverImage: 'https://image.tmdb.org/t/p/w1280/9n2tJBplPbgR2ca05hS5JAVeI0e.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/gEU2QniE6E77NI6lCU6MxlNBvVQ.jpg',
    rules: ['Cite scenes and sources.', 'Welcome beginners without condescension.'],
  },
  {
    name: 'Midnight Screening',
    slug: 'midnight-screening',
    description: 'Horror, cult and late-night rituals for the sleepless cinephile.',
    category: 'midnight',
    coverImage: 'https://image.tmdb.org/t/p/w1280/6FfCtAuGA9Wetg99kUAXyFKmvR.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/wVYREutTvI2tmxr6ujrHT704wGF.jpg',
    rules: ['Content warnings for graphic material.', 'No gore for shock alone — discuss craft.'],
  },
  {
    name: 'The Auteur Club',
    slug: 'the-auteur-club',
    description: 'Directors as authors — signatures, obsessions and complete filmographies.',
    category: 'auteur',
    coverImage: 'https://image.tmdb.org/t/p/w1280/5P8SmZzCdYYmgQd2bLFZ3Lfjb5.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
    rules: ['One filmmaker deep-dives welcome.', 'Compare across eras with care.'],
  },
  {
    name: 'Anime After Hours',
    slug: 'anime-after-hours',
    description: 'Animation as cinema — Studio Ghibli to experimental shorts after midnight.',
    category: 'anime',
    coverImage: 'https://image.tmdb.org/t/p/w1280/bOGkgRGdHRJYCy70bZD8bQYChk.jpg',
    avatar: 'https://image.tmdb.org/t/p/w185/39wmItkW3BOjdwPRiMZmX9vtFIz.jpg',
    rules: ['Distinguish anime and Western animation thoughtfully.', 'Spoiler tags for finales.'],
  },
];

export async function ensureFeaturedCommunities() {
  const existing = await Community.countDocuments({ isFeatured: true });
  if (existing >= FEATURED.length) return { seeded: false, count: existing };

  let owner = await User.findOne({ isAdmin: true }).select('_id').lean();
  if (!owner) owner = await User.findOne().sort({ createdAt: 1 }).select('_id').lean();
  if (!owner) {
    console.warn('[Community] Skip featured seed — no users exist yet.');
    return { seeded: false, count: 0 };
  }

  let created = 0;
  for (const item of FEATURED) {
    const found = await Community.findOne({ slug: item.slug });
    if (found) {
      if (!found.isFeatured) {
        found.isFeatured = true;
        await found.save();
      }
      continue;
    }
    const community = await Community.create({
      ...item,
      owner: owner._id,
      moderators: [owner._id],
      privacy: 'public',
      isFeatured: true,
      memberCount: 1,
      discussionCount: 0,
      lastActivityAt: new Date(),
    });
    await CommunityMember.create({
      community: community._id,
      user: owner._id,
      role: 'owner',
      status: 'active',
    });
    created += 1;
  }

  console.log(`[Community] Featured communities ready (${created} created).`);
  return { seeded: created > 0, count: created };
}
