// JustWatch API wrapper for direct OTT links
// Using dynamic import for justwatch-api since it might not support ES modules

// Map TMDB provider names to JustWatch provider names
const PROVIDER_NAME_MAP = {
  'Netflix': 'Netflix',
  'Amazon Prime Video': 'Amazon Prime Video',
  'Prime Video': 'Amazon Prime Video',
  'Disney Plus Hotstar': 'Hotstar',
  'Hotstar': 'Hotstar',
  'JioCinema': 'JioCinema',
  'Sony Liv': 'Sony Liv',
  'ZEE5': 'ZEE5',
  'Lionsgate Play': 'Lionsgate Play',
  'Apple TV Plus': 'Apple TV+',
  'Apple TV+': 'Apple TV+',
  'Hoichoi': 'Hoichoi',
  'Sun NXT': 'Sun NXT',
  'Eros Now': 'Eros Now',
  'MX Player': 'MX Player',
  // Add more as needed
};



/**
 * Normalizes the provider name by converting to lowercase, removing whitespace and special characters.
 * @param {string} name - The provider name
 * @returns {string} - The normalized provider name
 */
function normalizeProviderName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Fetches the first direct OTT streaming link for a movie by title, year, and (optionally) platform/provider name.
 * Only considers 'flatrate' (subscription) offers.
 * @param {string} title - The movie title
 * @param {number} year - The release year
 * @param {string} [platform] - The provider/platform name (e.g. 'Netflix') - optional
 * @returns {Promise<string|null>} - The direct OTT link or null if not found
 */
async function fetchDirectOTTLink(title, year, platform) {
  try {
    // Temporarily disabled due to ES module compatibility issues
    console.log('JustWatch functionality temporarily disabled');
    return null;
    
    // TODO: Fix ES module compatibility for justwatch-api
    // const JustWatch = (await import('justwatch-api')).default;
    // const justwatch = new JustWatch({ locale: 'en_IN' });
    // const results = await justwatch.search({ query: title, release_year: year });
    // const offers = results.items?.[0]?.offers;
    // if (offers && offers.length > 0) {
    //   // Only consider flatrate (subscription) offers
    //   let filteredOffers = offers.filter(o => o.monetization_type === 'flatrate' && o.urls?.standard_web);
    //   if (platform) {
    //     const mapped = PROVIDER_NAME_MAP[platform] || platform;
    //     const normMapped = normalizeProviderName(mapped);
    //     // Debug: log all provider names for this movie
    //     console.log('JustWatch offers for', title, year, ':', filteredOffers.map(o => o.provider_name));
    //     // Try to match provider name (case-insensitive, ignore whitespace/special chars)
    //     let exactMatch = filteredOffers.filter(o => o.provider_name && normalizeProviderName(o.provider_name) === normMapped);
    //     if (exactMatch.length === 0) {
    //       // fallback: partial match
    //       exactMatch = offers.filter(o => o.monetization_type === 'flatrate' && o.urls?.standard_web && o.provider_name && normalizeProviderName(o.provider_name).includes(normMapped));
    //     }
    //     // Debug: log what was matched
    //     if (exactMatch.length > 0) {
    //       console.log('Matched offer for', platform, ':', exactMatch[0].provider_name, exactMatch[0].urls.standard_web);
    //       return exactMatch[0].urls.standard_web;
    //     } else {
    //       console.log('No match for', platform, 'in', filteredOffers.map(o => o.provider_name));
    //       // fallback: return first available flatrate offer if any
    //       if (filteredOffers.length > 0) {
    //         console.log('Fallback: returning first available flatrate offer:', filteredOffers[0].provider_name, filteredOffers[0].urls.standard_web);
    //         return filteredOffers[0].urls.standard_web;
    //       }
    //     }
    //   } else if (filteredOffers.length > 0) {
    //     // No platform specified, return first available
    //     return filteredOffers[0].urls.standard_web;
    //   }
    // }
    // return null;
  } catch (e) {
    console.error('JustWatch error:', e);
    return null;
  }
}

export { fetchDirectOTTLink };
