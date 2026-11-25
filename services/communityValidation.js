import sanitizeHtml from 'sanitize-html';
import {
  ALL_COMMUNITY_CATEGORY_KEYS,
  COMMUNITY_LIMITS as LIMITS,
  RESERVED_COMMUNITY_SLUGS,
  SLUG_RE,
  slugifyCommunity,
} from '../data/communityOptions.js';

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};
const PRIVACY_VALUES = ['public', 'private', 'restricted'];
const MEDIA_PATH_RE = /^\/api\/community\/media\/[a-f\d]{24}\/(?:avatar|cover)(?:\?v=\d{1,16})?$/i;

// Community text is stored as plain text (About uses markdown-style markers that
// the client renders as React text nodes). Every HTML tag is removed here so the
// stored value is inert even if a future consumer renders it differently.
export function stripMarkup(input) {
  let text = typeof input === 'string' ? input : '';
  for (let pass = 0; pass < 4; pass += 1) {
    const next = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} })
      .replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, entity => ENTITIES[entity]);
    if (next === text) break;
    text = next;
  }
  return text.replace(/<\/?[a-zA-Z!][^<>]*>/g, '');
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;

export function cleanLine(input) {
  return stripMarkup(input)
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanBlock(input) {
  return stripMarkup(input)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/\t/g, '  ')
    .replace(/[ \u00a0]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateSlug(input) {
  const slug = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!slug) return { slug, error: 'Choose a web address for the community.' };
  if (RESERVED_COMMUNITY_SLUGS.includes(slug)) {
    return { slug, error: 'That web address is reserved. Please choose another.' };
  }
  if (slug.length < LIMITS.slugMin || slug.length > LIMITS.slugMax) {
    return { slug, error: `Web address must be ${LIMITS.slugMin}–${LIMITS.slugMax} characters.` };
  }
  if (!SLUG_RE.test(slug)) {
    return { slug, error: 'Use lowercase letters, numbers and single hyphens only.' };
  }
  return { slug, error: null };
}

export function normalizeTopics(input) {
  const raw = Array.isArray(input)
    ? input
    : (typeof input === 'string' ? input.split(',') : []);
  const topics = [];
  const seen = new Set();
  let error = null;

  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const topic = cleanLine(entry)
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N} &'-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!topic) continue;
    if (topic.length < LIMITS.topicMin || topic.length > LIMITS.topicMax) {
      error = `Each topic must be ${LIMITS.topicMin}–${LIMITS.topicMax} characters.`;
      continue;
    }
    if (seen.has(topic)) continue;
    seen.add(topic);
    topics.push(topic);
  }

  if (topics.length > LIMITS.topicsMax) {
    return { topics: topics.slice(0, LIMITS.topicsMax), error: `Add up to ${LIMITS.topicsMax} topics.` };
  }
  return { topics, error };
}

// Accepts the legacy shape (array of strings) and the structured shape
// ({ title, body }). Order is the array order.
export function normalizeRules(input) {
  if (!Array.isArray(input)) return { rules: [], error: null };
  const rules = [];
  let error = null;

  for (const entry of input) {
    const title = cleanLine(typeof entry === 'string' ? entry : entry?.title);
    const body = typeof entry === 'string' ? '' : cleanBlock(entry?.body);
    if (!title && !body) continue;
    if (title.length < LIMITS.ruleTitleMin) {
      error = 'Every rule needs a short title.';
      continue;
    }
    if (title.length > LIMITS.ruleTitleMax) {
      error = `Rule titles can be up to ${LIMITS.ruleTitleMax} characters.`;
      continue;
    }
    if (body.length > LIMITS.ruleBodyMax) {
      error = `Rule explanations can be up to ${LIMITS.ruleBodyMax} characters.`;
      continue;
    }
    rules.push({ title, body });
  }

  if (rules.length > LIMITS.rulesMax) {
    return { rules: rules.slice(0, LIMITS.rulesMax), error: `Add up to ${LIMITS.rulesMax} rules.` };
  }
  return { rules, error };
}

// Image references supplied as text: empty, our own media endpoint, or https.
export function isAllowedImageUrl(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || value.length > 500) return false;
  if (MEDIA_PATH_RE.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Detects the real image type from file signatures instead of trusting the
// client-declared MIME type.
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  const head = buffer.toString('latin1', 0, 6);
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  return null;
}

/**
 * Validates community fields from a request body.
 * `partial: true` (settings update) only validates keys that are present.
 * Returns sanitized `value` plus a field → message `errors` map.
 */
export function validateCommunityInput(body, { partial = false } = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const has = key => Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined;
  const value = {};
  const errors = {};

  if (!partial || has('name')) {
    const name = cleanLine(source.name);
    if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
      errors.name = `Community name must be ${LIMITS.nameMin}–${LIMITS.nameMax} characters.`;
    }
    value.name = name;
  }

  if (!partial) {
    const candidate = typeof source.slug === 'string' && source.slug.trim()
      ? slugifyCommunity(source.slug)
      : slugifyCommunity(value.name);
    const { slug, error } = validateSlug(candidate);
    if (error) errors.slug = error;
    value.slug = slug;
  }

  if (!partial || has('tagline')) {
    const tagline = cleanLine(source.tagline);
    if (tagline.length > LIMITS.taglineMax) {
      errors.tagline = `Tagline can be up to ${LIMITS.taglineMax} characters.`;
    }
    value.tagline = tagline;
  }

  if (!partial || has('description')) {
    const description = cleanBlock(source.description);
    if (description.length < LIMITS.descriptionMin || description.length > LIMITS.descriptionMax) {
      errors.description = `About must be ${LIMITS.descriptionMin}–${LIMITS.descriptionMax} characters.`;
    }
    value.description = description;
  }

  if (!partial || has('category')) {
    const category = typeof source.category === 'string' && source.category.trim()
      ? source.category.trim()
      : 'general';
    if (!ALL_COMMUNITY_CATEGORY_KEYS.includes(category)) {
      errors.category = 'Choose one of the listed categories.';
    }
    value.category = category;
  }

  if (!partial || has('topics')) {
    const { topics, error } = normalizeTopics(source.topics);
    if (error) errors.topics = error;
    value.topics = topics;
  }

  if (!partial || has('rules')) {
    const { rules, error } = normalizeRules(source.rules);
    if (error) errors.rules = error;
    value.ruleItems = rules;
  }

  if (!partial || has('privacy')) {
    const privacy = has('privacy') ? source.privacy : 'public';
    if (!PRIVACY_VALUES.includes(privacy)) {
      errors.privacy = 'Choose Public or Private.';
    }
    value.privacy = privacy;
  }

  return { value, errors, valid: Object.keys(errors).length === 0 };
}
