import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getReportDateRange,
  parseIndianBoxOfficeFeed,
  parseIndianDailyChartHtml,
  parseIndianMovieDaywiseHtml,
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

test('parses compact RSS briefs with Day N collection lines', () => {
  const feed = `<rss><channel><item>
    <title>Ramayana Day 16: ₹15.75 Cr India nett</title>
    <link>https://indian-boxoffice.com/briefs/2026-11-21/</link>
    <pubDate>Sat, 21 Nov 2026 15:30:41 GMT</pubDate>
    <description>7:00 IST: Ramayana Day 15: ₹19.35 Cr India nett 20:00 IST: Ramayana Day 16: ₹15.75 Cr India nett</description>
  </item></channel></rss>`;

  const { dailyReports } = parseIndianBoxOfficeFeed(feed);
  assert.equal(dailyReports.length, 1);
  assert.equal(dailyReports[0].movieTitle, 'Ramayana');
  assert.equal(dailyReports[0].dayNumber, 16);
  assert.equal(dailyReports[0].dailyCollection, 157_500_000);
  assert.equal(dailyReports[0].reportDate, '2026-11-21');
});

test('parses the live daily chart HTML table for all playing films', () => {
  const html = `
    <p>Updated 2026-11-21 (IST).</p>
    <table>
      <tr class="live">
        <td class="rank">1</td>
        <td class="title-cell">
          <a href="/movies/OM_Chapter_1_Udhiram_2026/" aria-label="Open details for O.M Operation Mole">
            <span>O.M Operation Mole<span class="pill">Playing</span></span>
          </a>
        </td>
        <td>Indian</td>
        <td><strong>Day 1</strong></td>
        <td class="num strong">₹18.10 Cr</td>
        <td class="num">—</td>
        <td class="num">₹36.20 Cr</td>
        <td class="num">₹36.20 Cr</td>
      </tr>
      <tr class="live">
        <td class="rank">2</td>
        <td class="title-cell">
          <a href="/movies/ramayana_part_1_2026/" aria-label="Open details for Ramayana">
            <span>Ramayana<span class="pill">Playing</span></span>
          </a>
        </td>
        <td>Indian</td>
        <td><strong>Day 16</strong></td>
        <td class="num strong">₹15.75 Cr</td>
        <td class="num">-18.6%</td>
        <td class="num">₹895.3 Cr</td>
        <td class="num">₹1,574.0 Cr</td>
      </tr>
    </table>
  `;

  const parsed = parseIndianDailyChartHtml(html);
  assert.equal(parsed.reportDate, '2026-11-21');
  assert.equal(parsed.dailyReports.length, 2);
  assert.equal(parsed.dailyReports[0].movieTitle, 'O.M Operation Mole');
  assert.equal(parsed.dailyReports[0].dailyCollection, 181_000_000);
  assert.equal(parsed.dailyReports[0].cumulativeCollection, 362_000_000);
  assert.equal(parsed.dailyReports[0].sourceMovieKey, 'OM_Chapter_1_Udhiram_2026');
  assert.equal(parsed.dailyReports[1].movieTitle, 'Ramayana');
  assert.equal(parsed.dailyReports[1].dayNumber, 16);

  const net = parsed.lifetimeReports.find(report => report.collectionType === 'india_nett' && report.movieTitle === 'Ramayana');
  const ww = parsed.lifetimeReports.find(report => report.collectionType === 'worldwide_gross' && report.movieTitle === 'Ramayana');
  assert.equal(net.amount, 8_953_000_000);
  assert.equal(ww.amount, 15_740_000_000);
});

test('computes UTC week and month ranges without including the next period', () => {
  const week = getReportDateRange('weekly', '2026-11-13');
  assert.equal(week.start.toISOString().slice(0, 10), '2026-11-09');
  assert.equal(week.end.toISOString().slice(0, 10), '2026-11-16');

  const month = getReportDateRange('monthly', '2026-11-13');
  assert.equal(month.start.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(month.end.toISOString().slice(0, 10), '2026-12-01');
});

test('parses full Day 1→N movie page day-wise table', () => {
  const html = `
    <h1>Ramayana box office</h1>
    <table>
      <thead><tr><th>Day</th><th>Date</th><th>India nett</th><th>Worldwide</th></tr></thead>
      <tbody>
        <tr><td><strong>Day 1 (Opening)</strong></td><td>6 Nov 2026</td><td>₹64.85 Cr</td><td>₹100.0 Cr</td></tr>
        <tr><td><strong>Day 2</strong></td><td>7 Nov 2026</td><td>₹48.05 Cr</td><td>₹180.0 Cr</td></tr>
        <tr><td><strong>Day 3</strong></td><td>8 Nov 2026</td><td>₹69.80 Cr</td><td>₹280.5 Cr</td></tr>
      </tbody>
    </table>
  `;
  const parsed = parseIndianMovieDaywiseHtml(html, { sourceMovieKey: 'ramayana_part_1_2026' });
  assert.equal(parsed.dailyReports.length, 3);
  assert.equal(parsed.dailyReports[0].dayNumber, 1);
  assert.equal(parsed.dailyReports[0].reportDate, '2026-11-06');
  assert.equal(parsed.dailyReports[0].dailyCollection, 648_500_000);
  assert.equal(parsed.dailyReports[2].cumulativeCollection, 1_827_000_000);
  const nett = parsed.lifetimeReports.find(report => report.collectionType === 'india_nett');
  const ww = parsed.lifetimeReports.find(report => report.collectionType === 'worldwide_gross');
  assert.equal(nett.amount, 1_827_000_000);
  assert.equal(ww.amount, 2_805_000_000);
});
