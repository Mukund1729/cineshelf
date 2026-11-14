import BlogPost from '../models/BlogPost.js';
import sanitizeHtml from 'sanitize-html';

const ARTICLE_SANITIZER_OPTIONS = {
  allowedTags: [
    'a', 'blockquote', 'br', 'code', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
    'hr', 'img', 'li', 'ol', 'p', 'pre', 's', 'strong', 'sub', 'sup', 'u', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }),
  },
};

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function normalizeTags(value) {
  const tags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(tags.map(tag => String(tag).trim().slice(0, 60)).filter(Boolean))].slice(0, 20);
}

// GET /api/blog — All published posts
export const getPosts = async (req, res) => {
  try {
    const { category, limit = 20, page = 1 } = req.query;
    const query = { published: true };
    if (category) query.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [posts, total] = await Promise.all([
      BlogPost.find(query)
        .populate('author', 'username name avatar')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-content'),
      BlogPost.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch posts' });
  }
};

export const getAdminPosts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const query = { source: 'local' };
    const [posts, total] = await Promise.all([
      BlogPost.find(query)
        .populate('author', 'username name avatar')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-content')
        .lean(),
      BlogPost.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Blog] Admin list failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch admin posts' });
  }
};

// GET /api/blog/:slug — Single post by slug
export const getPostBySlug = async (req, res) => {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, published: true },
      { $inc: { views: 1 } },
      { new: true }
    ).populate('author', 'username name avatar');

    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch post' });
  }
};

// POST /api/blog — Create post (admin only)
export const createPost = async (req, res) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string'
      ? sanitizeHtml(req.body.content.trim(), ARTICLE_SANITIZER_OPTIONS)
      : '';
    const slug = slugify(typeof req.body.slug === 'string' && req.body.slug.trim()
      ? req.body.slug
      : title);
    if (!title || !slug || !content) {
      return res.status(400).json({ success: false, error: 'Title and article content are required' });
    }

    const category = ['review', 'feature', 'editorial', 'list', 'interview', 'news', 'essay'].includes(req.body.category)
      ? req.body.category
      : 'essay';
    const tags = normalizeTags(req.body.tags);
    const published = req.body.published !== false;
    const publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : new Date();
    if (Number.isNaN(publishedAt.getTime())) {
      return res.status(400).json({ success: false, error: 'Publication date is invalid' });
    }

    const post = new BlogPost({
      title,
      slug,
      content,
      excerpt: typeof req.body.excerpt === 'string' && req.body.excerpt.trim()
        ? req.body.excerpt.trim().slice(0, 1000)
        : sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).slice(0, 200),
      author: req.user.id,
      authorName: 'Mukund Mangal',
      category: category || 'feature',
      categories: [category, ...tags],
      coverImage: typeof req.body.coverImage === 'string' ? req.body.coverImage.trim() : '',
      tags,
      source: 'local',
      published,
      publishedAt: published ? publishedAt : undefined,
    });
    await post.save();
    await post.populate('author', 'username name avatar');
    res.status(201).json({ success: true, data: post, message: 'Post created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Slug already exists' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error('[Blog] Create failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
};

// PUT /api/blog/:id — Update post (admin only)
export const updatePost = async (req, res) => {
  try {
    const { title, content, excerpt, category, coverImage, tags, published } = req.body;
    const updateData = { title, content, excerpt, category, coverImage, tags, published };
    if (published) updateData.publishedAt = new Date();

    const post = await BlogPost.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true })
      .populate('author', 'username name avatar');

    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, data: post, message: 'Post updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update post' });
  }
};

// DELETE /api/blog/:id — Delete post (admin only)
export const deletePost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
};
