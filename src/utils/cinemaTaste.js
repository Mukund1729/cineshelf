/** TMDB genre id → name (stable reference list). */
const TMDB_GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

function topCounts(map, limit = 3) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Build cinema-taste insights from real profile activity only.
 * Never invents genres, directors, or ratings.
 */
export function buildCinemaTaste({ profile, reviews = [], diary = [], watchlist = [] } = {}) {
  const rated = (reviews || []).filter(r => Number.isFinite(Number(r.rating)));
  const avgRating = rated.length
    ? Math.round((rated.reduce((sum, r) => sum + Number(r.rating), 0) / rated.length) * 10) / 10
    : null;

  const uniqueWatched = new Set(
    (diary || []).map(e => e.tmdbId).filter(id => Number.isFinite(Number(id)))
  ).size;

  const genreCounts = new Map();
  (watchlist || []).forEach(m => {
    (m.genreIds || []).forEach(id => {
      const name = TMDB_GENRES[id];
      if (!name) return;
      genreCounts.set(name, (genreCounts.get(name) || 0) + 1);
    });
  });
  const mostWatchedGenres = topCounts(genreCounts, 4);

  const favouriteGenres = [
    ...new Set([
      ...(profile?.favouriteGenres || []),
      ...(profile?.preferences?.moviePreferences?.preferredGenres || []),
    ].filter(Boolean)),
  ].slice(0, 6);

  const favouriteLanguages = [
    ...new Set((profile?.preferences?.moviePreferences?.preferredLanguages || []).filter(Boolean)),
  ].slice(0, 4);

  const decadeCounts = new Map();
  [...(watchlist || []), ...(reviews || [])].forEach(item => {
    const raw = item.releaseDate || item.release_date || '';
    const year = String(raw).slice(0, 4);
    if (!/^\d{4}$/.test(year)) return;
    const decade = `${year.slice(0, 3)}0s`;
    decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
  });
  const topDecade = topCounts(decadeCounts, 1)[0]?.name || null;

  const hasSignal = Boolean(
    favouriteGenres.length
    || mostWatchedGenres.length
    || favouriteLanguages.length
    || avgRating != null
    || topDecade
    || uniqueWatched > 0
  );

  return {
    hasSignal,
    favouriteGenres,
    mostWatchedGenres,
    favouriteLanguages,
    averageRating: avgRating,
    topDecade,
    uniqueWatched,
    diaryEntries: (diary || []).length,
    reviewCount: (reviews || []).length,
  };
}
