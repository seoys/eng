import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';
import { createDeck } from '../src/models/decks.js';
import { insertWords } from '../src/models/words.js';
import { registerTestUser } from './testUtils.js';

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

test('sending a challenge requires having already played the deck', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('도전덱', alice.userId);
  await insertWords(deck.id, [{ word: 'a', meaning: 'ㄱ' }], alice.userId);

  const response = await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: bob.userId },
    headers: alice.authHeaders,
  });

  assert.equal(response.statusCode, 400);

  await app.close();
});

test('a played deck can be turned into a challenge that shows up for the recipient', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('도전덱2', alice.userId);
  await insertWords(deck.id, [{ word: 'a', meaning: 'ㄱ' }], alice.userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 8, total: 10 },
    headers: alice.authHeaders,
  });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: bob.userId },
    headers: alice.authHeaders,
  });
  assert.equal(createResponse.statusCode, 201);
  const created = JSON.parse(createResponse.body);
  assert.equal(created.targetScore, 80);
  assert.equal(created.fromName, '앨리스');
  assert.equal(created.toName, '밥');

  const bobInbox = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: bob.authHeaders })).body,
  );
  assert.equal(bobInbox.received.length, 1);
  assert.equal(bobInbox.received[0].targetScore, 80);
  assert.equal(bobInbox.received[0].deckName, '도전덱2');
  assert.equal(bobInbox.sent.length, 0);

  const bobWordsResponse = await app.inject({
    method: 'GET',
    url: `/api/decks/${deck.id}/words`,
    headers: bob.authHeaders,
  });
  assert.equal(bobWordsResponse.statusCode, 200, 'sending a challenge should auto-share the deck');

  const aliceOutbox = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: alice.authHeaders })).body,
  );
  assert.equal(aliceOutbox.sent.length, 1);
  assert.equal(aliceOutbox.received.length, 0);

  await app.close();
});

test('cannot challenge yourself', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const deck = await createDeck('도전덱3', alice.userId);
  await insertWords(deck.id, [{ word: 'a', meaning: 'ㄱ' }], alice.userId);
  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 1, total: 1 },
    headers: alice.authHeaders,
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: alice.userId },
    headers: alice.authHeaders,
  });

  assert.equal(response.statusCode, 400);

  await app.close();
});

test('cannot challenge someone using a deck you have no access to', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const carol = await registerTestUser(app, { name: '캐롤' });
  const deck = await createDeck('비공개덱', alice.userId);
  await insertWords(deck.id, [{ word: 'a', meaning: 'ㄱ' }], alice.userId);
  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 1, total: 1 },
    headers: alice.authHeaders,
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: carol.userId },
    headers: bob.authHeaders,
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});
