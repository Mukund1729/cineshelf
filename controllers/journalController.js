import BlogPost from '../models/BlogPost.js';
import {
  getMediumJournalSyncStatus,
  syncMediumJournal,
} from '../services/mediumJournalService.js';

function boundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getJournalPosts(req, res) {
  try {
    const page = boundedInteger(req.query.page, 1, 100000);
    const limit = boundedInteger(req.query.limit, 12, 30);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim().slice(0, 60) : '';
    const sort = req.query.sort === 'oldest' ? 1 : -1;
    const query = { source: 'medium', published: true };

    if (search) {
      const matcher = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { title: matcher },
        { subtitle: matcher },
        { excerpt: matcher },
        { categories: matcher },
        { tags: matcher },
      ];
    }
    if (category) query.$and = [{ $or: [{ categories: category }, { tags: category }] }];

    const [posts, total] = await Promise.all([
      BlogPost.find(query)
        .sort({ publishedAt: sort, _id: sort })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-content -sourceId')
        .lean(),
      BlogPost.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Journal] Listing failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch journal articles' });
  }
}

export async function getJournalArticle(req, res) {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, source: 'medium', published: true },
      { $inc: { views: 1 } },
      { new: true }
    ).populate('author', 'username name avatar').lean();

    if (!post) return res.status(404).json({ success: false, error: 'Journal article not found' });
    const relatedQuery = {
      source: 'medium',
      published: true,
      _id: { $ne: post._id },
    };
    if (post.categories?.length) relatedQuery.categories = { $in: post.categories };

    const related = await BlogPost.find(relatedQuery)
      .sort({ publishedAt: -1 })
      .limit(3)
      .select('title slug excerpt coverImage publishedAt readingTime categories canonicalUrl')
      .lean();

    res.json({ success: true, data: { ...post, related } });
  } catch (error) {
    console.error('[Journal] Article lookup failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch journal article' });
  }
}

export async function getJournalAdminStatus(req, res) {
  try {
    res.json({ success: true, data: await getMediumJournalSyncStatus() });
  } catch (error) {
    console.error('[Journal] Sync status lookup failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch journal sync status' });
  }
}

export async function runJournalSync(req, res) {
  try {
    const result = await syncMediumJournal();
    if (result.skipped) {
      return res.status(409).json({ success: false, error: 'A Journal synchronization is already running.' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Journal] Manual sync failed:', error.message);
    res.status(502).json({ success: false, error: 'Medium synchronization failed. Check the latest sync report.' });
  }
}
