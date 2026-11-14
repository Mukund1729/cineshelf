import { createHash, randomBytes } from 'node:crypto';
import fetch from 'node-fetch';
import sanitizeHtml from 'sanitize-html';
import BlogPost from '../models/BlogPost.js';
import MediumJournalSync from '../models/MediumJournalSync.js';

export const MEDIUM_RSS_URL = 'https://medium.com/feed/@mukundmangal2173';
const SYNC_STATE_ID = 'medium-journal';
const MAX_FEED_BYTES = 5 * 1024 * 1024;
const MAX_ARTICLE_CONTENT_CHARS = 40000;
const BATCH_SIZE = 20;
const LEASE_DURATION_MS = 15 * 60 * 1000;

const ARTICLE_SANITIZER_OPTIONS = {
  allowedTags: [
    'a', 'blockquote', 'br', 'code', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
    'hr', 'img', 'li', 'ol', 'p', 'pre', 's', 'strong', 'sub', 'sup', 'u', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }),
  },
};

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
    }[entity.toLowerCase()]));
}

function xmlValue(xml, tagName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}\\s*>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function safeMediumUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (url.hostname !== 'medium.com' && !url.hostname.endsWith('.medium.com')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function imageFromContent(html) {
  const image = html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (image) return safeImageUrl(image[1]);
  const thumbnail = html.match(/<media:thumbnail\b[^>]*\burl\s*=\s*["']([^"']+)["']/i);
  return thumbnail ? safeImageUrl(decodeXml(thumbnail[1])) : '';
}

function plainText(html) {
  return sanitizeHtml(html || '', { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function mediumSlug(title, sourceId) {
  const titleSlug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || 'article';
  const suffix = createHash('sha256').update(sourceId).digest('hex').slice(0, 10);
  return `medium-${titleSlug}-${suffix}`;
}

export function parseMediumFeed(xml) {
  const channelMatch = xml.match(/<channel(?:\s[^>]*)?>([\s\S]*?)<\/channel\s*>/i);
  const channel = channelMatch ? channelMatch[1] : xml;
  const items = [...channel.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)];
  const continuationAvailable = /<atom:link\b[^>]*\brel=["']next["']/i.test(channel);
  const articles = items.map(([, item]) => {
    const title = plainText(xmlValue(item, 'title'));
    const link = safeMediumUrl(xmlValue(item, 'link'));
    const guid = xmlValue(item, 'guid');
    const sourceId = (guid || link).slice(0, 500);
    const rawContent = xmlValue(item, 'content:encoded') || xmlValue(item, 'description');
    const rawDescription = xmlValue(item, 'description');
    const contentHtml = sanitizeHtml(rawContent, ARTICLE_SANITIZER_OPTIONS);
    const descriptionHtml = sanitizeHtml(rawDescription, ARTICLE_SANITIZER_OPTIONS);
    const contentText = plainText(contentHtml);
    const descriptionText = plainText(descriptionHtml);
    const fullContentAvailable = Boolean(xmlValue(item, 'content:encoded'));
    const boundedContent = contentHtml.length <= MAX_ARTICLE_CONTENT_CHARS
      ? contentHtml
      : `<p>${escapeHtml((descriptionText || contentText).slice(0, 1200))}</p>`;
    const publishedAtValue = xmlValue(item, 'pubDate') || xmlValue(item, 'dc:date');
    const publishedAt = publishedAtValue ? new Date(publishedAtValue) : null;
    const categories = [...item.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category\s*>/gi)]
      .map(([, category]) => plainText(decodeXml(category)))
      .filter(Boolean);
    const excerpt = (descriptionText || contentText).slice(0, 1000);
    const wordCount = (contentText || excerpt).split(/\s+/).filter(Boolean).length;

    return {
      title,
      sourceId,
      slug: sourceId ? mediumSlug(title, sourceId) : '',
      canonicalUrl: link,
      subtitle: plainText(xmlValue(item, 'media:description')),
      excerpt,
      content: boundedContent || (excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''),
      coverImage: imageFromContent(rawContent) || safeImageUrl(xmlValue(item, 'media:content')),
      categories: [...new Set(categories)],
      tags: [...new Set(categories)],
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      readingTime: Math.max(1, Math.ceil(wordCount / 220)),
      contentAvailable: fullContentAvailable && contentHtml.length <= MAX_ARTICLE_CONTENT_CHARS,
      missingMetadata: !xmlValue(item, 'media:description') || categories.length === 0 || !imageFromContent(rawContent),
      valid: Boolean(title && sourceId && link),
    };
  });

  return { articles, continuationAvailable };
}

async function fetchMediumFeed() {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(MEDIUM_RSS_URL, {
        headers: { Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) {
          throw new Error(`Medium RSS returned HTTP ${response.status}`);
        }
        throw new Error(`Medium RSS temporarily returned HTTP ${response.status}`);
      }
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) {
        throw new Error('Medium RSS response exceeded the configured size limit');
      }
      const feed = await response.text();
      if (Buffer.byteLength(feed, 'utf8') > MAX_FEED_BYTES) {
        throw new Error('Medium RSS response exceeded the configured size limit');
      }
      return feed;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }
  throw lastError;
}

async function claimSyncLease() {
  const now = new Date();
  const leaseToken = randomBytes(18).toString('hex');
  try {
    const state = await MediumJournalSync.findOneAndUpdate(
      {
        _id: SYNC_STATE_ID,
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: 'running',
          lastAttemptAt: now,
          leaseToken,
          leaseUntil: new Date(now.getTime() + LEASE_DURATION_MS),
          message: '',
        },
        $setOnInsert: { _id: SYNC_STATE_ID },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return state ? leaseToken : null;
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

function articleUpdate(article, syncedAt) {
  const fields = {
    source: 'medium',
    sourceId: article.sourceId,
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle,
    content: article.content,
    excerpt: article.excerpt,
    authorName: 'Mukund Mangal',
    category: article.categories[0] ? 'editorial' : 'essay',
    coverImage: article.coverImage,
    categories: article.categories,
    tags: article.tags,
    canonicalUrl: article.canonicalUrl,
    readingTime: article.readingTime,
    contentAvailable: article.contentAvailable,
    lastSyncedAt: syncedAt,
    published: true,
  };
  if (article.publishedAt) fields.publishedAt = article.publishedAt;
  return fields;
}

export async function syncMediumJournal() {
  const leaseToken = await claimSyncLease();
  if (!leaseToken) return { skipped: true };

  let report = {
    totalDiscovered: 0,
    imported: 0,
    updated: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
    missingImages: 0,
    missingMetadata: 0,
    oldestArticleAt: null,
    newestArticleAt: null,
    continuationAvailable: false,
  };

  try {
    const feed = await fetchMediumFeed();
    const parsed = parseMediumFeed(feed);
    report.totalDiscovered = parsed.articles.length;
    report.continuationAvailable = parsed.continuationAvailable;

    const validArticles = parsed.articles.filter(article => {
      if (!article.valid) {
        report.skipped += 1;
        return false;
      }
      if (!article.coverImage) report.missingImages += 1;
      if (article.missingMetadata) report.missingMetadata += 1;
      return true;
    });
    const dates = validArticles.map(article => article.publishedAt).filter(Boolean).sort((a, b) => a - b);
    report.oldestArticleAt = dates[0] || null;
    report.newestArticleAt = dates[dates.length - 1] || null;

    const syncedAt = new Date();
    for (let start = 0; start < validArticles.length; start += BATCH_SIZE) {
      const batch = validArticles.slice(start, start + BATCH_SIZE);
      try {
        const result = await BlogPost.bulkWrite(
          batch.map(article => ({
            updateOne: {
              filter: { source: 'medium', sourceId: article.sourceId },
              update: {
                $set: articleUpdate(article, syncedAt),
                $setOnInsert: { views: 0 },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
        report.imported += result.upsertedCount || 0;
        report.updated += result.modifiedCount || 0;
        report.duplicates += Math.max(0, (result.matchedCount || 0) - (result.modifiedCount || 0));
      } catch (error) {
        report.failed += batch.length;
        console.error('[Medium Journal] Batch import failed:', error.message);
      }
    }

    await MediumJournalSync.updateOne(
      { _id: SYNC_STATE_ID, leaseToken },
      {
        $set: {
          ...report,
          status: report.failed ? 'failed' : 'succeeded',
          lastSuccessfulSyncAt: report.failed ? undefined : syncedAt,
          message: report.continuationAvailable
            ? 'The feed advertises a continuation link; additional pages should be imported.'
            : 'Imported the currently exposed RSS window. Medium did not provide a continuation link.',
        },
        $unset: { leaseToken: 1, leaseUntil: 1 },
      }
    );
    return { skipped: false, ...report };
  } catch (error) {
    await MediumJournalSync.updateOne(
      { _id: SYNC_STATE_ID, leaseToken },
      {
        $set: { status: 'failed', message: error.message },
        $unset: { leaseToken: 1, leaseUntil: 1 },
      }
    );
    throw error;
  }
}

export async function getMediumJournalSyncStatus() {
  const [state, articleDates] = await Promise.all([
    MediumJournalSync.findById(SYNC_STATE_ID).select('-leaseToken -leaseUntil').lean(),
    BlogPost.aggregate([
      { $match: { source: 'medium', published: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          oldestArticleAt: { $min: '$publishedAt' },
          newestArticleAt: { $max: '$publishedAt' },
        },
      },
    ]),
  ]);
  return {
    ...(state || { status: 'idle', totalDiscovered: 0, imported: 0, failed: 0 }),
    importedArticleCount: articleDates[0]?.total || 0,
    oldestImportedArticleAt: articleDates[0]?.oldestArticleAt || null,
    newestImportedArticleAt: articleDates[0]?.newestArticleAt || null,
    feedUrl: MEDIUM_RSS_URL,
    historicalCompleteness: 'limited_to_public_rss_window',
    continuationAvailable: state?.continuationAvailable || false,
  };
}
