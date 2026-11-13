import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getReportDateRange,
  parseIndianBoxOfficeFeed,
} from '../services/boxOfficeDataService.js';

test('parses source-reported India nett and worldwide amounts without mixing types', () => {
  const feed = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>India box office: Ramayana leads the latest daily chart at ₹53.5 Cr</title>
        <link>https://indian-boxoffice.com/briefs/2026-11-12/</link>
        <pubDate>Thu, 12 Nov 2026 11:57:30 GMT</pubDate>
        <description><![CDATA[Ramayana leads the latest reported daily India nett at ₹53.5 Cr on Day 8, taking cumulative India nett to ₹618.1 Cr and worldwide gross to ₹1,033.6 Cr on the consensus desk.]]></description>
      </item>
      <item>
        <title>Ramayana box office — ₹1,033.6 Cr WW / ₹618.1 Cr India nett</title>
        <link>https://indian-boxoffice.com/movies/ramayana_part_1_2026/</link>
        <pubDate>Fri, 13 Nov 2026 14:15:43 GMT</pubDate>
        <description>Ramayana (Hindi) — verdict Pending. India nett ₹618.1 Cr, worldwide ₹1,033.6 Cr.</description>
      </item>
    </channel></rss>`;

  const { dailyReports, lifetimeReports } = parseIndianBoxOfficeFeed(feed);
  assert.equal(dailyReports.length, 1);
  assert.equal(dailyReports[0].movieTitle, 'Ramayana');
  assert.equal(dailyReports[0].reportDate, '2026-11-12');
  assert.equal(dailyReports[0].dailyCollection, 535_000_000);
  assert.equal(dailyReports[0].cumulativeCollection, 6_181_000_000);
  assert.equal(dailyReports[0].sourceReportedValue, '₹53.5 Cr');
  assert.equal(dailyReports[0].sourceReportedCumulativeValue, '₹618.1 Cr');

  const netReport = lifetimeReports.find(report => report.collectionType === 'india_nett');
  const worldwideReport = lifetimeReports.find(report => report.collectionType === 'worldwide_gross');
  assert.equal(netReport.amount, 6_181_000_000);
  assert.equal(netReport.sourceReportedValue, '₹618.1 Cr');
  assert.equal(netReport.territory, 'IN');
  assert.equal(worldwideReport.amount, 10_336_000_000);
  assert.equal(worldwideReport.sourceReportedValue, '₹1,033.6 Cr');
  assert.equal(worldwideReport.territory, 'WW');
  assert.equal(dailyReports[0].sourceMovieKey, 'ramayana_part_1_2026');
});

test('does not create reports when a feed item has no numeric collection', () => {
  const feed = `<rss><channel><item>
    <title>India box office: Sample daily chart</title>
    <link>https://indian-boxoffice.com/briefs/2026-11-12/</link>
    <pubDate>Thu, 12 Nov 2026 11:57:30 GMT</pubDate>
    <description>Collections are not available yet.</description>
  </item></channel></rss>`;

  const result = parseIndianBoxOfficeFeed(feed);
  assert.deepEqual(result, { dailyReports: [], lifetimeReports: [] });
});

test('computes UTC week and month ranges without including the next period', () => {
  const week = getReportDateRange('weekly', '2026-11-13');
  assert.equal(week.start.toISOString().slice(0, 10), '2026-11-09');
  assert.equal(week.end.toISOString().slice(0, 10), '2026-11-16');

  const month = getReportDateRange('monthly', '2026-11-13');
  assert.equal(month.start.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(month.end.toISOString().slice(0, 10), '2026-12-01');
});
