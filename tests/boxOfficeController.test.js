import test from 'node:test';
import assert from 'node:assert/strict';
import BoxOfficeLifetime from '../models/BoxOfficeLifetime.js';
import {
  getBoxOfficeDaily,
  getBoxOfficeHistoryChart,
  getBoxOfficeWorldwide,
} from '../controllers/boxOfficeController.js';

function createResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function withLifetimeQueryMocks(callback, total = 63) {
  const originalFind = BoxOfficeLifetime.find;
  const originalCountDocuments = BoxOfficeLifetime.countDocuments;
  const calls = {};
  BoxOfficeLifetime.find = query => {
    calls.query = query;
    const chain = {
      sort(value) {
        calls.sort = value;
        return chain;
      },
      skip(value) {
        calls.skip = value;
        return chain;
      },
      limit(value) {
        calls.limit = value;
        return chain;
      },
      lean: async () => [{ movieTitle: 'Reported film' }],
    };
    return chain;
  };
  BoxOfficeLifetime.countDocuments = async query => {
    calls.countQuery = query;
    return total;
  };
  try {
    await callback(calls);
  } finally {
    BoxOfficeLifetime.find = originalFind;
    BoxOfficeLifetime.countDocuments = originalCountDocuments;
  }
}

test('worldwide reports apply filters and return the requested page', async () => {
  await withLifetimeQueryMocks(async calls => {
    const response = createResponse();
    await getBoxOfficeWorldwide({
      query: { date: '2026-02-01', language: 'hi', page: '2', limit: '40' },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.page, 2);
    assert.equal(response.body.limit, 40);
    assert.equal(response.body.total, 63);
    assert.equal(response.body.pages, 2);
    assert.deepEqual(response.body.reports, [{ movieTitle: 'Reported film' }]);
    assert.deepEqual(calls.query, {
      expiresAt: { $gt: calls.query.expiresAt.$gt },
      collectionType: 'worldwide_gross',
      originalLanguage: 'hi',
      reportDate: {
        $gte: new Date('2026-02-01T00:00:00.000Z'),
        $lt: new Date('2026-02-02T00:00:00.000Z'),
      },
    });
    assert.equal(calls.skip, 40);
    assert.equal(calls.limit, 40);
  });
});

test('daily worldwide reports reject an invalid page size', async () => {
  const response = createResponse();
  await getBoxOfficeDaily({
    query: { market: 'worldwide', date: '2026-02-01', limit: '101' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'invalid_pagination');
});

test('history charts reject unsupported markets and invalid foreign territories', async () => {
  const unsupportedMarket = createResponse();
  await getBoxOfficeHistoryChart({
    query: { market: 'india', period: 'daily', date: '2026-11-09' },
  }, unsupportedMarket);
  assert.equal(unsupportedMarket.statusCode, 400);
  assert.equal(unsupportedMarket.body.error, 'invalid_market');

  const indiaTerritory = createResponse();
  await getBoxOfficeHistoryChart({
    query: { market: 'international', period: 'weekend', country: 'IN', date: '2026-11-09' },
  }, indiaTerritory);
  assert.equal(indiaTerritory.statusCode, 400);
  assert.equal(indiaTerritory.body.error, 'invalid_country');

  const malformedDate = createResponse();
  await getBoxOfficeHistoryChart({
    query: { market: 'us', period: 'daily', date: '2026-02-30' },
  }, malformedDate);
  assert.equal(malformedDate.statusCode, 400);
  assert.equal(malformedDate.body.error, 'invalid_date');
});
