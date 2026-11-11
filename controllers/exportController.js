import User from '../models/User.js';
import Watchlist from '../models/Watchlist.js';
import Review from '../models/Review.js';
import List from '../models/List.js';

// Export all user data
export const exportUserData = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch all user data
    const user = await User.findById(userId).select('-password');
    const watchlist = await Watchlist.find({ user: userId });
    const reviews = await Review.find({ user: userId });
    const lists = await List.find({ user: userId });
    
    const exportData = {
      user: {
        profile: user,
        preferences: user.preferences
      },
      watchlist: watchlist,
      reviews: reviews,
      lists: lists,
      exportDate: new Date().toISOString()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cineshelf-data-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export user data error:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
};

// Export watchlist
export const exportWatchlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const watchlist = await Watchlist.find({ user: userId });
    
    const { format = 'json' } = req.query;
    
    if (format === 'csv') {
      const csvData = watchlist.map(item => ({
        title: item.title,
        tmdbId: item.tmdbId,
        poster: item.poster,
        addedAt: item.createdAt
      }));
      
      const csv = convertToCSV(csvData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="watchlist-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="watchlist-${Date.now()}.json"`);
      res.json(watchlist);
    }
  } catch (error) {
    console.error('Export watchlist error:', error);
    res.status(500).json({ error: 'Failed to export watchlist' });
  }
};

// Export reviews
export const exportReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const reviews = await Review.find({ user: userId });
    
    const { format = 'json' } = req.query;
    
    if (format === 'csv') {
      const csvData = reviews.map(review => ({
        title: review.title,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      }));
      
      const csv = convertToCSV(csvData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="reviews-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="reviews-${Date.now()}.json"`);
      res.json(reviews);
    }
  } catch (error) {
    console.error('Export reviews error:', error);
    res.status(500).json({ error: 'Failed to export reviews' });
  }
};

// Export lists
export const exportLists = async (req, res) => {
  try {
    const userId = req.user.id;
    const lists = await List.find({ user: userId });
    
    const { format = 'json' } = req.query;
    
    if (format === 'csv') {
      const csvData = lists.map(list => ({
        title: list.title,
        description: list.description,
        movies: list.movies.join(', '),
        createdAt: list.createdAt,
        updatedAt: list.updatedAt
      }));
      
      const csv = convertToCSV(csvData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="lists-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="lists-${Date.now()}.json"`);
      res.json(lists);
    }
  } catch (error) {
    console.error('Export lists error:', error);
    res.status(500).json({ error: 'Failed to export lists' });
  }
};

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
} 