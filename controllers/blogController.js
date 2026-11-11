import BlogPost from '../models/BlogPost.js';

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
    const { title, slug, content, excerpt, category, coverImage, tags, published } = req.body;
    if (!title || !slug || !content) {
      return res.status(400).json({ success: false, error: 'Title, slug, and content are required' });
    }

    const post = new BlogPost({
      title,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      content,
      excerpt: excerpt || content.substring(0, 200),
      author: req.user.id,
      category: category || 'feature',
      coverImage: coverImage || '',
      tags: tags || [],
      published: published || false,
      publishedAt: published ? new Date() : undefined,
    });
    await post.save();
    await post.populate('author', 'username name avatar');
    res.status(201).json({ success: true, data: post, message: 'Post created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Slug already exists' });
    }
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
