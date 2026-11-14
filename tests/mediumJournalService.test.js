import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMediumFeed } from '../services/mediumJournalService.js';

test('Medium RSS parser extracts article metadata and sanitizes imported HTML', () => {
  const feed = `<?xml version="1.0"?>
    <rss xmlns:content="http://purl.org/rss/1.0/modules/content/"
         xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <atom:link href="https://medium.com/feed/@mukundmangal2173" rel="self" />
        <item>
          <title><![CDATA[Cinema &amp; memory]]></title>
          <link>https://medium.com/@mukundmangal2173/cinema-memory-abc123</link>
          <guid>medium-article-abc123</guid>
          <pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate>
          <description><![CDATA[<p>A short essay excerpt.</p>]]></description>
          <content:encoded><![CDATA[
            <p onclick="alert(1)">A story about cinema.</p>
            <script>alert("unsafe")</script>
            <img src="https://cdn-images.medium.com/example.jpg" onerror="alert(1)" />
          ]]></content:encoded>
        </item>
      </channel>
    </rss>`;

  const { articles, nextUrl } = parseMediumFeed(feed);
  assert.equal(nextUrl, '');
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Cinema & memory');
  assert.equal(articles[0].canonicalUrl, 'https://medium.com/@mukundmangal2173/cinema-memory-abc123');
  assert.equal(articles[0].publishedAt.toISOString(), '2026-10-26T10:00:00.000Z');
  assert.equal(articles[0].contentAvailable, true);
  assert.match(articles[0].content, /A story about cinema/);
  assert.doesNotMatch(articles[0].content, /script|onclick|onerror/i);
  assert.equal(articles[0].coverImage, 'https://cdn-images.medium.com/example.jpg');
  assert.deepEqual(articles[0].categories, []);
});

test('Medium RSS parser recognizes only safe Medium continuation links', () => {
  const feed = `<rss xmlns:atom="http://www.w3.org/2005/Atom"><channel>
    <atom:link href="https://medium.com/feed/@mukundmangal2173?page=2&amp;cursor=abc" rel="next" />
  </channel></rss>`;
  const result = parseMediumFeed(feed);
  assert.equal(result.articles.length, 0);
  assert.equal(result.nextUrl, 'https://medium.com/feed/@mukundmangal2173?page=2&cursor=abc');

  const unsafeFeed = `<rss xmlns:atom="http://www.w3.org/2005/Atom"><channel>
    <atom:link rel="next" href="https://example.com/next" />
  </channel></rss>`;
  assert.equal(parseMediumFeed(unsafeFeed).nextUrl, '');
});
