import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';
import { createDeck } from '../src/models/decks.js';
import { insertWords } from '../src/models/words.js';
import { registerTestUser, wordList } from './testUtils.js';

const TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/eng_quiz_test';

before(async () => {
  await connectMongo(TEST_URI);
});

beforeEach(async () => {
  const db = getDb();
  await db.collection('decks').deleteMany({});
  await db.collection('words').deleteMany({});
  await db.collection('users').deleteMany({});
  await db.collection('quiz_results').deleteMany({});
  await db.collection('challenges').deleteMany({});
});

after(async () => {
  await closeMongo();
});

test('GET /api/achievements starts with every badge unearned', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { authHeaders } = await registerTestUser(app);

  const response = await app.inject({
    method: 'GET',
    url: '/api/achievements',
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 200);
  const badges = JSON.parse(response.body);
  assert.ok(badges.length > 0);
  assert.ok(badges.every((b) => b.earned === false));

  const first100 = badges.find((b) => b.id === 'first-100');
  assert.ok(first100);
  assert.equal(first100.title, '첫 100점');

  await app.close();
});

test('GET /api/achievements marks "first-100" earned after a perfect quiz', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('업적덱', userId);
  await insertWords(deck.id, wordList(20), userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 4, total: 5 },
    headers: authHeaders,
  });

  let response = await app.inject({ method: 'GET', url: '/api/achievements', headers: authHeaders });
  let badges = JSON.parse(response.body);
  assert.equal(badges.find((b) => b.id === 'first-100').earned, false);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 5, total: 5 },
    headers: authHeaders,
  });

  response = await app.inject({ method: 'GET', url: '/api/achievements', headers: authHeaders });
  badges = JSON.parse(response.body);
  assert.equal(badges.find((b) => b.id === 'first-100').earned, true);

  await app.close();
});

test('GET /api/achievements marks "first-deck" earned once a deck is created', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);

  let badges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: authHeaders })).body,
  );
  assert.equal(badges.find((b) => b.id === 'first-deck').earned, false);

  await createDeck('첫덱', userId);

  badges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: authHeaders })).body,
  );
  assert.equal(badges.find((b) => b.id === 'first-deck').earned, true);

  await app.close();
});

test('GET /api/achievements marks "quiz-count-10" earned after ten recorded quizzes', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('반복덱', userId);
  await insertWords(deck.id, wordList(20), userId);

  for (let i = 0; i < 9; i += 1) {
    await app.inject({
      method: 'POST',
      url: '/api/quiz/results',
      payload: { deckId: deck.id, correct: 1, total: 1 },
      headers: authHeaders,
    });
  }
  let badges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: authHeaders })).body,
  );
  assert.equal(badges.find((b) => b.id === 'quiz-count-10').earned, false);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 1, total: 1 },
    headers: authHeaders,
  });
  badges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: authHeaders })).body,
  );
  assert.equal(badges.find((b) => b.id === 'quiz-count-10').earned, true);

  await app.close();
});

test('GET /api/achievements marks "first-challenge-sent" earned after sending one', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('도전배지덱', alice.userId);
  await insertWords(deck.id, wordList(20), alice.userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 1, total: 1 },
    headers: alice.authHeaders,
  });

  let badges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: alice.authHeaders })).body,
  );
  assert.equal(badges.find((b) => b.id === 'first-challenge-sent').earned, false);

  await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: bob.userId },
    headers: alice.authHeaders,
  });

  badges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: alice.authHeaders })).body,
  );
  assert.equal(badges.find((b) => b.id === 'first-challenge-sent').earned, true);

  await app.close();
});

test('GET /api/achievements marks "challenge-winner" earned once the recipient beats the target', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('도전배지덱2', alice.userId);
  await insertWords(deck.id, wordList(20), alice.userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 4, total: 5 },
    headers: alice.authHeaders,
  });
  await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: bob.userId },
    headers: alice.authHeaders,
  });

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 3, total: 5 },
    headers: bob.authHeaders,
  });
  let bobBadges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: bob.authHeaders })).body,
  );
  assert.equal(bobBadges.find((b) => b.id === 'challenge-winner').earned, false);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 5, total: 5 },
    headers: bob.authHeaders,
  });
  bobBadges = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/achievements', headers: bob.authHeaders })).body,
  );
  assert.equal(bobBadges.find((b) => b.id === 'challenge-winner').earned, true);

  await app.close();
});

test('GET /api/achievements returns 401 without a token', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const response = await app.inject({ method: 'GET', url: '/api/achievements' });
  assert.equal(response.statusCode, 401);
  await app.close();
});
