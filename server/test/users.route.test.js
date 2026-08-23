import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';
import { registerTestUser } from './testUtils.js';

const TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/eng_quiz_test';

before(async () => {
  await connectMongo(TEST_URI);
});

beforeEach(async () => {
  await getDb().collection('users').deleteMany({});
});

after(async () => {
  await closeMongo();
});

test('GET /api/users lists other users but excludes yourself', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  await registerTestUser(app, { name: '밥' });

  const response = await app.inject({
    method: 'GET',
    url: '/api/users',
    headers: alice.authHeaders,
  });

  assert.equal(response.statusCode, 200);
  const users = JSON.parse(response.body);
  assert.equal(users.length, 1);
  assert.equal(users[0].name, '밥');

  await app.close();
});

test('GET /api/users returns 401 without a token', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const response = await app.inject({ method: 'GET', url: '/api/users' });
  assert.equal(response.statusCode, 401);
  await app.close();
});
