import CustomList from '../models/CustomList.js';

// GET /api/lists — Get all lists for current user
export const getUserLists = async (req, res) => {
  try {
    const lists = await CustomList.find({ user: req.user.id })
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: lists });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/lists/public — Get all public lists (community)
export const getPublicLists = async (req, res) => {
  try {
    const lists = await CustomList.find({ isPublic: true })
      .populate('user', 'username name avatar')
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json({ success: true, data: lists });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/lists/user/:userId — Get public lists of a specific user
export const getListsByUser = async (req, res) => {
  try {
    const query = { user: req.params.userId, isPublic: true };
    // If requesting own lists, show all
    if (req.user && req.user.id === req.params.userId) {
      delete query.isPublic;
    }
    const lists = await CustomList.find(query).sort({ updatedAt: -1 });
    res.json({ success: true, data: lists });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET /api/lists/:id — Get a single list
export const getList = async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id)
      .populate('user', 'username name avatar');
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    // Check visibility
    if (!list.isPublic) {
      if (!req.user || req.user.id !== list.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'This list is private' });
      }
    }
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/lists — Create a new list
export const createList = async (req, res) => {
  try {
    const { name, description, coverImage, isPublic } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'List name is required' });
    }
    const list = new CustomList({
      user: req.user.id,
      name: name.trim(),
      description: description || '',
      coverImage: coverImage || '',
      isPublic: isPublic !== undefined ? isPublic : true,
      items: [],
    });
    await list.save();
    res.status(201).json({ success: true, data: list, message: 'List created' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// PUT /api/lists/:id — Update a list
export const updateList = async (req, res) => {
  try {
    const { name, description, coverImage, isPublic } = req.body;
    const list = await CustomList.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { name, description, coverImage, isPublic } },
      { new: true, runValidators: true }
    );
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });
    res.json({ success: true, data: list, message: 'List updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// DELETE /api/lists/:id — Delete a list
export const deleteList = async (req, res) => {
  try {
    const list = await CustomList.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });
    res.json({ success: true, message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST /api/lists/:id/items — Add movie/show to a list
export const addToList = async (req, res) => {
  try {
    const { tmdbId, title, poster, overview, releaseDate, voteAverage, mediaType, note } = req.body;
    if (!tmdbId || !title) {
      return res.status(400).json({ success: false, error: 'tmdbId and title are required' });
    }
    const list = await CustomList.findOne({ _id: req.params.id, user: req.user.id });
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    // Prevent duplicates
    const exists = list.items.find(item => item.tmdbId === Number(tmdbId));
    if (exists) return res.status(409).json({ success: false, error: 'Already in this list' });

    list.items.push({
      tmdbId: Number(tmdbId),
      title,
      poster: poster || '',
      overview: overview || '',
      releaseDate: releaseDate || '',
      voteAverage: voteAverage || 0,
      mediaType: mediaType || 'movie',
      note: note || '',
      order: list.items.length,
    });
    await list.save();
    res.json({ success: true, data: list, message: 'Added to list' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// DELETE /api/lists/:id/items/:tmdbId — Remove from a list
export const removeFromList = async (req, res) => {
  try {
    const list = await CustomList.findOne({ _id: req.params.id, user: req.user.id });
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    list.items = list.items.filter(item => item.tmdbId !== Number(req.params.tmdbId));
    await list.save();
    res.json({ success: true, data: list, message: 'Removed from list' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
