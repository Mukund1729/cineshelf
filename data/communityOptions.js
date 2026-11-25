// Shared community constants. Dependency-free so both the API (Node) and the
// Vite frontend import the same source of truth.

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const COMMUNITY_LIMITS = {
  nameMin: 3,
  nameMax: 80,
  slugMin: 3,
  slugMax: 60,
  taglineMax: 140,
  descriptionMin: 20,
  descriptionMax: 4000,
  topicsMax: 8,
  topicMin: 2,
  topicMax: 30,
  rulesMax: 12,
  ruleTitleMin: 3,
  ruleTitleMax: 120,
  ruleBodyMax: 500,
  imageBytes: 5 * 1024 * 1024,
};

export const COMMUNITY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Categories offered when creating or editing a community.
export const COMMUNITY_CATEGORIES = [
  { key: 'world-cinema', label: 'World Cinema' },
  { key: 'indian-cinema', label: 'Indian Cinema' },
  { key: 'film-discussion', label: 'Film Discussion' },
  { key: 'filmmaking', label: 'Filmmaking' },
  { key: 'film-criticism', label: 'Film Criticism' },
  { key: 'directors', label: 'Directors and Filmmakers' },
  { key: 'screenwriting', label: 'Screenwriting' },
  { key: 'cinematography', label: 'Cinematography' },
  { key: 'film-history', label: 'Film History' },
  { key: 'animation', label: 'Animation' },
  { key: 'documentary', label: 'Documentary' },
  { key: 'film-clubs', label: 'Film Clubs' },
  { key: 'tv-series', label: 'TV and Series' },
  { key: 'other', label: 'Other' },
];

// Categories used by communities created before the setup redesign. They stay
// valid so existing records never fail validation.
export const LEGACY_COMMUNITY_CATEGORIES = [
  { key: 'auteur', label: 'Auteur Cinema' },
  { key: 'genre', label: 'Genre Cinema' },
  { key: 'regional', label: 'Regional Cinema' },
  { key: 'theory', label: 'Film Theory' },
  { key: 'anime', label: 'Anime' },
  { key: 'midnight', label: 'Midnight and Cult' },
  { key: 'general', label: 'General' },
];

export const ALL_COMMUNITY_CATEGORY_KEYS = [
  ...LEGACY_COMMUNITY_CATEGORIES.map(item => item.key),
  ...COMMUNITY_CATEGORIES.map(item => item.key),
];

const CATEGORY_LABELS = new Map(
  [...LEGACY_COMMUNITY_CATEGORIES, ...COMMUNITY_CATEGORIES].map(item => [item.key, item.label])
);

export function communityCategoryLabel(key) {
  return CATEGORY_LABELS.get(key) || 'Other';
}

export const COMMUNITY_PRIVACY = {
  public: {
    label: 'Public',
    summary: 'Anyone can find it, read discussions and join instantly.',
  },
  private: {
    label: 'Private',
    summary: 'Hidden from discovery. People with the link can request to join; '
      + 'discussions, members and media are visible only to members you approve.',
  },
  restricted: {
    label: 'Restricted',
    summary: 'Listed in discovery, but discussions are visible only to approved members.',
  },
};

// Path segments owned by the community API and frontend routes. A community
// with one of these slugs would be unreachable.
export const RESERVED_COMMUNITY_SLUGS = [
  'home', 'feed', 'spotlight', 'list', 'me', 'user', 'users', 'posts', 'post',
  'media', 'check-slug', 'new', 'create', 'settings', 'edit', 'admin', 'api',
  'search', 'discover', 'trending', 'featured', 'members', 'join', 'leave',
];

// Optional starting points only — nothing here is applied automatically.
export const STARTER_RULES = [
  {
    title: 'Mark spoilers clearly',
    body: 'Use the spoiler toggle for plot details, endings and twists so others can choose when to read them.',
  },
  {
    title: 'Argue with the film, not the person',
    body: 'Disagreement is welcome. Personal attacks, harassment and hate speech are not.',
  },
  {
    title: 'Stay on topic',
    body: 'Keep posts relevant to what this community is about.',
  },
  {
    title: 'Credit your sources',
    body: 'Link or name the interviews, essays and critics you quote.',
  },
  {
    title: 'No piracy links',
    body: 'Do not share or request illegal streams or downloads.',
  },
];

export const ABOUT_PROMPTS = [
  'What kind of cinema brings this community together?',
  'Who is it for — newcomers, obsessives, working filmmakers?',
  'What sort of posts and conversations do you hope to see?',
  'Is there a ritual — a weekly watch, a monthly theme, a reading list?',
];

export function slugifyCommunity(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, COMMUNITY_LIMITS.slugMax)
    .replace(/-+$/g, '');
}

// Plain-text excerpt of the About text for cards and profile lists.
export function summarizeCommunityText(text, max = 180) {
  const plain = String(text || '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:–-]+$/, '')}…`;
}
