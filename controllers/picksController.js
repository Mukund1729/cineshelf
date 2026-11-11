import Pick from '../models/Pick.js';
import CustomList from '../models/CustomList.js';
import User from '../models/User.js';

// Seed data — only run if no picks exist in DB
const seedPicks = async () => {
  const count = await Pick.countDocuments();
  if (count > 0) return;

  // Find or create a system admin user for seeding
  let admin = await User.findOne({ isAdmin: true });
  if (!admin) return; // Skip seed if no admin exists yet

  const initialPicks = [
    {
      title: 'Visual Masterpieces',
      description: 'Films that redefine cinematography and visual storytelling — where every frame is a painting.',
      type: 'visual',
      movies: ['2001: A Space Odyssey', 'Blade Runner 2049', 'The Grand Budapest Hotel', 'Satantango', 'In the Mood for Love'],
      featured: true,
      creator: admin._id,
    },
    {
      title: "Editor's Choice 2024",
      description: 'Our top picks for the most compelling films of the year — cinema at its most vital.',
      type: 'editor',
      movies: ['Poor Things', 'The Zone of Interest', 'Anatomy of a Fall', 'Past Lives', 'All of Us Strangers'],
      featured: true,
      creator: admin._id,
    },
    {
      title: '90s Cinema Revolution',
      description: 'The decade that changed independent filmmaking forever. Rogue voices, raw energy.',
      type: 'decade',
      movies: ['Pulp Fiction', 'Fargo', 'The Big Lebowski', 'Chungking Express', 'Trainspotting', 'Boogie Nights'],
      featured: false,
      creator: admin._id,
    },
    {
      title: 'Christopher Nolan Collection',
      description: 'Exploring the mind-bending narratives of a modern master of cinema.',
      type: 'director',
      movies: ['Inception', 'Memento', 'Interstellar', 'Dunkirk', 'Oppenheimer', 'The Prestige'],
      featured: true,
      creator: admin._id,
    },
    {
      title: 'Denis Villeneuve Spotlight',
      description: 'Atmospheric masterworks from the director who redefined modern sci-fi.',
      type: 'director',
      movies: ['Arrival', 'Blade Runner 2049', 'Dune', 'Prisoners', 'Sicario', 'Enemy'],
      featured: false,
      creator: admin._id,
    },
    {
      title: 'New Wave Indian Cinema',
      description: 'A renaissance of Indian independent film — intimate, honest, and deeply human.',
      type: 'community',
      movies: ['Masaan', 'The Lunchbox', 'Gangs of Wasseypur', 'Piku', 'Court', 'Udaan'],
      featured: true,
      creator: admin._id,
    },
  ];

  await Pick.insertMany(initialPicks);
  console.log('✅ Cinematic picks seeded to MongoDB');
};

// Run seed on module load (safe — only seeds if empty)
seedPicks().catch(err => console.error('Seed error:', err));

// GET /api/picks — Get all picks
export const getAllPicks = async (req, res) => {
  try {
    const { type, featured } = req.query;
    const query = {};
    if (type)     query.type = type;
    if (featured) query.featured = featured === 'true';

    const picks = await Pick.find(query)
      .populate('creator', 'username name avatar')
      .sort({ featured: -1, createdAt: -1 });

    res.json({ success: true, data: picks });
  } catch (error) {
    console.error('Get all picks error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch picks' });
  }
};

// GET /api/picks/type/:type — Get picks by type
export const getPicksByType = async (req, res) => {
  try {
    const { type } = req.params;
    const picks = await Pick.find({ type })
      .populate('creator', 'username name avatar')
      .sort({ featured: -1, createdAt: -1 });
    res.json({ success: true, data: picks });
  } catch (error) {
    console.error('Get picks by type error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch picks by type' });
  }
};

// GET /api/picks/community — Get community public lists
export const getCommunityLists = async (req, res) => {
  try {
    const lists = await CustomList.find({ isPublic: true })
      .populate('user', 'username name avatar')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, data: lists });
  } catch (error) {
    console.error('Get community lists error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch community lists' });
  }
};

// GET /api/picks/directors — Get director spotlight picks
export const getDirectorSpotlights = async (req, res) => {
  try {
    const picks = await Pick.find({ type: 'director' })
      .populate('creator', 'username name avatar')
      .sort({ featured: -1, createdAt: -1 });
    res.json({ success: true, data: picks });
  } catch (error) {
    console.error('Get director spotlights error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch director spotlights' });
  }
};

// POST /api/picks — Create a new pick (admin only)
export const createPick = async (req, res) => {
  try {
    const { title, description, type, image, movies, featured, tags } = req.body;
    if (!title || !description || !type) {
      return res.status(400).json({ success: false, error: 'Title, description, and type are required' });
    }
    const pick = new Pick({
      title,
      description,
      type,
      image: image || null,
      movies: movies || [],
      featured: featured || false,
      creator: req.user.id,
      tags: tags || [],
    });
    await pick.save();
    await pick.populate('creator', 'username name avatar');
    res.status(201).json({ success: true, data: pick, message: 'Pick created' });
  } catch (error) {
    console.error('Create pick error:', error);
    res.status(500).json({ success: false, error: 'Failed to create pick' });
  }
};

// PUT /api/picks/:id — Update a pick (admin only)
export const updatePick = async (req, res) => {
  try {
    const { title, description, type, image, movies, featured, tags } = req.body;
    const pick = await Pick.findByIdAndUpdate(
      req.params.id,
      { $set: { title, description, type, image, movies, featured, tags } },
      { new: true, runValidators: true }
    ).populate('creator', 'username name avatar');

    if (!pick) return res.status(404).json({ success: false, error: 'Pick not found' });
    res.json({ success: true, data: pick, message: 'Pick updated' });
  } catch (error) {
    console.error('Update pick error:', error);
    res.status(500).json({ success: false, error: 'Failed to update pick' });
  }
};

// DELETE /api/picks/:id — Delete a pick (admin only)
export const deletePick = async (req, res) => {
  try {
    const pick = await Pick.findByIdAndDelete(req.params.id);
    if (!pick) return res.status(404).json({ success: false, error: 'Pick not found' });
    res.json({ success: true, message: 'Pick deleted' });
  } catch (error) {
    console.error('Delete pick error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete pick' });
  }
};