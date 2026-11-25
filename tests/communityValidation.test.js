import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_COMMUNITY_CATEGORY_KEYS,
  COMMUNITY_CATEGORIES,
  COMMUNITY_LIMITS,
  RESERVED_COMMUNITY_SLUGS,
  communityCategoryLabel,
  slugifyCommunity,
  summarizeCommunityText,
} from '../data/communityOptions.js';
import {
  cleanBlock,
  cleanLine,
  escapeRegex,
  isAllowedImageUrl,
  normalizeRules,
  normalizeTopics,
  sniffImageType,
  stripMarkup,
  validateCommunityInput,
  validateSlug,
} from '../services/communityValidation.js';

const ABOUT = 'A room for people who watch slowly and argue kindly about cinema.';

test('categories keep every original key and add the new setup categories', () => {
  for (const legacy of ['auteur', 'genre', 'regional', 'theory', 'anime', 'midnight', 'general']) {
    assert.ok(ALL_COMMUNITY_CATEGORY_KEYS.includes(legacy), `${legacy} must stay valid`);
  }
  assert.equal(COMMUNITY_CATEGORIES.length, 14);
  assert.equal(new Set(ALL_COMMUNITY_CATEGORY_KEYS).size, ALL_COMMUNITY_CATEGORY_KEYS.length);
  assert.equal(communityCategoryLabel('directors'), 'Directors and Filmmakers');
  assert.equal(communityCategoryLabel('auteur'), 'Auteur Cinema');
  assert.equal(communityCategoryLabel('unknown-key'), 'Other');
});

test('slugify produces clean web addresses', () => {
  assert.equal(slugifyCommunity('  The Nolanverse!  '), 'the-nolanverse');
  assert.equal(slugifyCommunity('Café Société — Films'), 'cafe-societe-films');
  assert.equal(slugifyCommunity('---'), '');
  assert.ok(slugifyCommunity('a'.repeat(200)).length <= COMMUNITY_LIMITS.slugMax);
  assert.ok(!slugifyCommunity(`${'a'.repeat(59)} b`).endsWith('-'));
});

test('slug validation rejects reserved, malformed and short addresses', () => {
  assert.equal(validateSlug('slow-cinema').error, null);
  for (const reserved of ['home', 'feed', 'me', 'posts', 'media', 'new', 'check-slug', 'settings']) {
    assert.ok(RESERVED_COMMUNITY_SLUGS.includes(reserved));
    assert.match(validateSlug(reserved).error, /reserved/);
  }
  assert.ok(validateSlug('ab').error);
  assert.ok(validateSlug('Bad Slug').error);
  assert.ok(validateSlug('double--hyphen').error);
  assert.ok(validateSlug('').error);
});

test('markup is stripped from every text field, including encoded payloads', () => {
  assert.equal(stripMarkup('<b>Bold</b> move'), 'Bold move');
  assert.equal(stripMarkup('<script>alert(1)</script>Hello'), 'Hello');
  assert.equal(stripMarkup('<img src=x onerror=alert(1)>Hi'), 'Hi');
  assert.ok(!/<|script/i.test(stripMarkup('&lt;script&gt;alert(1)&lt;/script&gt;ok')));
  assert.ok(!/<[a-z]/i.test(stripMarkup('&amp;lt;iframe src=x&amp;gt;ok')));
  assert.equal(stripMarkup('Tom & Jerry'), 'Tom & Jerry');
  assert.equal(stripMarkup('ratio 4 < 5 and 6 > 2'), 'ratio 4 < 5 and 6 > 2');
  assert.equal(stripMarkup(undefined), '');
  assert.equal(stripMarkup({ $ne: null }), '');
});

test('single-line and multi-line cleaning', () => {
  assert.equal(cleanLine('  Slow \n\t Cinema\u200b  '), 'Slow Cinema');
  assert.equal(cleanBlock('Line one\r\n\r\n\r\n\r\nLine two   \n'), 'Line one\n\nLine two');
  assert.equal(cleanBlock('## Heading\n- item <b>one</b>'), '## Heading\n- item one');
});

test('create validation accepts a minimal community and applies safe defaults', () => {
  const { value, errors, valid } = validateCommunityInput({ name: 'Slow Cinema Club', description: ABOUT });
  assert.equal(valid, true, JSON.stringify(errors));
  assert.equal(value.slug, 'slow-cinema-club');
  assert.equal(value.category, 'general');
  assert.equal(value.privacy, 'public');
  assert.equal(value.tagline, '');
  assert.deepEqual(value.topics, []);
  assert.deepEqual(value.ruleItems, []);
});

test('create validation reports each invalid field', () => {
  const { errors, valid } = validateCommunityInput({
    name: 'ab',
    slug: 'home',
    description: 'too short',
    tagline: 'x'.repeat(COMMUNITY_LIMITS.taglineMax + 1),
    category: 'not-a-category',
    privacy: 'secret',
    topics: Array.from({ length: 12 }, (_, i) => `topic ${i}`),
    rules: [{ title: '', body: 'body without a title' }],
  });
  assert.equal(valid, false);
  for (const field of ['name', 'slug', 'description', 'tagline', 'category', 'privacy', 'topics', 'rules']) {
    assert.ok(errors[field], `expected an error for ${field}`);
  }
});

test('non-string input never reaches the database as an operator', () => {
  const { value, valid } = validateCommunityInput({
    name: { $gt: '' },
    description: ['array'],
    category: { $ne: 'x' },
    privacy: { $ne: 'x' },
  });
  assert.equal(valid, false);
  assert.equal(value.name, '');
  assert.equal(value.description, '');
  assert.equal(value.category, 'general');
});

test('partial validation only touches provided fields', () => {
  const only = validateCommunityInput({ tagline: 'Watch slowly.' }, { partial: true });
  assert.equal(only.valid, true);
  assert.deepEqual(Object.keys(only.value), ['tagline']);

  const empty = validateCommunityInput({}, { partial: true });
  assert.deepEqual(empty.value, {});

  const bad = validateCommunityInput({ description: 'short' }, { partial: true });
  assert.ok(bad.errors.description);
  assert.equal(bad.errors.name, undefined);
});

test('topics are normalised, de-duplicated and limited', () => {
  assert.deepEqual(
    normalizeTopics(['#Neo-Noir', 'neo-noir', '  Slow   Cinema ', 'x', '<b>Kurosawa</b>']).topics,
    ['neo-noir', 'slow cinema', 'kurosawa']
  );
  assert.deepEqual(normalizeTopics('giallo, new wave').topics, ['giallo', 'new wave']);
  assert.ok(normalizeTopics(['x']).error);
  const many = normalizeTopics(Array.from({ length: 20 }, (_, i) => `topic ${i}`));
  assert.equal(many.topics.length, COMMUNITY_LIMITS.topicsMax);
  assert.ok(many.error);
  assert.deepEqual(normalizeTopics(null).topics, []);
});

test('rules accept legacy strings and structured items, preserving order', () => {
  const { rules, error } = normalizeRules([
    'Mark spoilers clearly.',
    { title: 'Be kind', body: 'Argue with the film,\nnot the person.' },
    { title: '', body: '' },
  ]);
  assert.equal(error, null);
  assert.deepEqual(rules, [
    { title: 'Mark spoilers clearly.', body: '' },
    { title: 'Be kind', body: 'Argue with the film,\nnot the person.' },
  ]);
  assert.ok(normalizeRules([{ title: 'x'.repeat(200) }]).error);
  assert.ok(normalizeRules([{ title: 'Fine title', body: 'y'.repeat(600) }]).error);
  assert.ok(normalizeRules(Array.from({ length: 20 }, (_, i) => `Rule number ${i}`)).error);
  assert.deepEqual(normalizeRules('not an array').rules, []);
});

test('image links must be https or our own media endpoint', () => {
  assert.equal(isAllowedImageUrl(''), true);
  assert.equal(isAllowedImageUrl('https://image.tmdb.org/t/p/w1280/abc.jpg'), true);
  assert.equal(isAllowedImageUrl('/api/community/media/64b7f0c2a1b2c3d4e5f60718/cover?v=1700000000000'), true);
  assert.equal(isAllowedImageUrl('http://example.com/a.jpg'), false);
  assert.equal(isAllowedImageUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedImageUrl('data:image/png;base64,AAAA'), false);
  assert.equal(isAllowedImageUrl('/api/user/avatar/../../etc'), false);
  assert.equal(isAllowedImageUrl('https://user:pass@example.com/a.jpg'), false);
  assert.equal(isAllowedImageUrl(`https://example.com/${'a'.repeat(600)}`), false);
});

test('image type is read from the file signature, not the declared type', () => {
  const pad = bytes => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);
  assert.equal(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffImageType(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)])), 'image/gif');
  assert.equal(
    sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)])),
    'image/webp'
  );
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), null);
  assert.equal(sniffImageType(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.equal(sniffImageType(Buffer.alloc(4)), null);
  assert.equal(sniffImageType(null), null);
});

test('card summaries are plain text without markdown markers', () => {
  assert.equal(
    summarizeCommunityText('## Welcome\n\n- **Slow** cinema\n- Long takes'),
    'Welcome Slow cinema Long takes'
  );
  const long = summarizeCommunityText('word '.repeat(100));
  assert.ok(long.length <= 181);
  assert.ok(long.endsWith('…'));
});

test('search input is escaped before becoming a pattern', () => {
  assert.equal(new RegExp(escapeRegex('(.*)+$')).test('(.*)+$'), true);
  assert.equal(new RegExp(escapeRegex('.*')).test('anything'), false);
});
