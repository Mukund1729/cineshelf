/**
 * Resolve direct OTT deep links (Netflix/Prime/etc.) via JustWatch GraphQL.
 * TMDB only exposes a JustWatch landing page — not provider title URLs.
 */

const JW_GRAPHQL = 'https://apis.justwatch.com/graphql';

const SEARCH_QUERY = `query GetSearchTitles($country: Country!, $language: Language!, $first: Int!, $searchQuery: String) {
  popularTitles(country: $country, language: $language, first: $first, filter: {searchQuery: $searchQuery}) {
    edges {
      node {
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          externalIds { imdbId tmdbId }
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          package { clearName technicalName packageId }
          standardWebURL
        }
      }
    }
  }
}`;

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function pickBestNode(edges, { tmdbId, title, year, mediaType = 'movie' }) {
  let nodes = (edges || []).map(edge => edge?.node).filter(Boolean);
  if (!nodes.length) return null;

  const wantShow = mediaType === 'tv' || mediaType === 'show';
  const typed = nodes.filter(node => {
    const type = String(node.objectType || '').toUpperCase();
    return wantShow ? type.includes('SHOW') : type.includes('MOVIE') || !type;
  });
  if (typed.length) nodes = typed;

  const tmdbKey = tmdbId != null ? String(tmdbId) : '';
  if (tmdbKey) {
    const byTmdb = nodes.find(node => String(node.content?.externalIds?.tmdbId || '') === tmdbKey);
    if (byTmdb) return byTmdb;
  }

  const normTitle = normalizeName(title);
  const yearNum = Number(year) || null;
  const titleMatches = nodes.filter(node => normalizeName(node.content?.title) === normTitle);
  if (yearNum && titleMatches.length) {
    const yearMatch = titleMatches.find(node => Number(node.content?.originalReleaseYear) === yearNum);
    if (yearMatch) return yearMatch;
  }
  return titleMatches[0] || nodes[0];
}

function collectOffers(node) {
  const byProviderId = {};
  const byName = {};
  const links = [];

  for (const offer of node?.offers || []) {
    const url = offer?.standardWebURL;
    if (!url || typeof url !== 'string') continue;
    // Skip JustWatch/TMDB landers — only keep real platform title pages
    if (/justwatch\.com|themoviedb\.org/i.test(url)) continue;

    const providerId = offer.package?.packageId;
    const clearName = offer.package?.clearName || '';
    const technicalName = offer.package?.technicalName || '';
    const monetizationType = String(offer.monetizationType || '').toUpperCase();

    const entry = {
      url,
      providerId,
      name: clearName,
      technicalName,
      monetizationType,
    };

    if (providerId != null && !byProviderId[providerId]) {
      byProviderId[providerId] = entry;
    }
    const nameKey = normalizeName(clearName);
    if (nameKey && !byName[nameKey]) {
      byName[nameKey] = entry;
    }
    if (technicalName && !byName[normalizeName(technicalName)]) {
      byName[normalizeName(technicalName)] = entry;
    }
    links.push(entry);
  }

  // Prefer flatrate/subscription first for "Watch now"
  const preferred = [...links].sort((a, b) => {
    const rank = type => (type === 'FLATRATE' ? 0 : type === 'ADS' ? 1 : type === 'FREE' ? 2 : 3);
    return rank(a.monetizationType) - rank(b.monetizationType);
  });

  const uniqueOffers = [];
  const seen = new Set();
  for (const offer of preferred) {
    const key = `${offer.providerId || offer.name}|${offer.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOffers.push(offer);
  }

  return {
    byProviderId,
    byName,
    preferredUrl: uniqueOffers[0]?.url || null,
    offers: uniqueOffers,
  };
}

export async function resolveOttLinks({
  tmdbId,
  title,
  year,
  country = 'IN',
  mediaType = 'movie',
} = {}) {
  if (!title && !tmdbId) {
    return { success: false, byProviderId: {}, byName: {}, preferredUrl: null, offers: [] };
  }

  const res = await fetch(JW_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; CineShelf/1.0)',
      Referer: 'https://www.justwatch.com/',
    },
    body: JSON.stringify({
      operationName: 'GetSearchTitles',
      query: SEARCH_QUERY,
      variables: {
        country,
        language: 'en',
        first: 12,
        searchQuery: title || String(tmdbId),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`JustWatch request failed (${res.status})`);
  }

  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'JustWatch GraphQL error');
  }

  const node = pickBestNode(payload?.data?.popularTitles?.edges, { tmdbId, title, year, mediaType });
  if (!node) {
    return {
      success: true,
      matchedTitle: null,
      byProviderId: {},
      byName: {},
      preferredUrl: null,
      offers: [],
      attribution: 'JustWatch',
    };
  }

  const collected = collectOffers(node);
  return {
    success: true,
    matchedTitle: node.content?.title || null,
    matchedYear: node.content?.originalReleaseYear || null,
    ...collected,
    attribution: 'JustWatch',
  };
}
