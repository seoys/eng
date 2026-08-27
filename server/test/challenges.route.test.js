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

test('sending a challenge requires having already played the deck', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('도전덱', alice.userId);
  await insertWords(deck.id, wordList(20), alice.userId);

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
  await insertWords(deck.id, wordList(20), alice.userId);

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
  await insertWords(deck.id, wordList(20), alice.userId);
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

test('a received challenge disappears once you beat the target score', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('도전덱4', alice.userId);
  await insertWords(deck.id, wordList(20), alice.userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 8, total: 10 },
    headers: alice.authHeaders,
  });
  await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: bob.userId },
    headers: alice.authHeaders,
  });

  const beforeBeat = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: bob.authHeaders })).body,
  );
  assert.equal(beforeBeat.received.length, 1);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 5, total: 10 },
    headers: bob.authHeaders,
  });
  const stillLosing = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: bob.authHeaders })).body,
  );
  assert.equal(stillLosing.received.length, 1, 'a lower score should not clear the challenge');

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 9, total: 10 },
    headers: bob.authHeaders,
  });
  const afterBeat = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: bob.authHeaders })).body,
  );
  assert.equal(afterBeat.received.length, 0, 'beating the target score should clear the challenge');

  await app.close();
});

test('GET /api/challenges reports battle results for both sides once the recipient has played', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('도전덱5', alice.userId);
  await insertWords(deck.id, wordList(20), alice.userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 3, total: 10 },
    headers: alice.authHeaders,
  });
  await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: bob.userId },
    headers: alice.authHeaders,
  });

  const beforePlay = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: alice.authHeaders })).body,
  );
  assert.equal(beforePlay.battles.length, 0, 'no battle result until the recipient plays');

  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 7, total: 10 },
    headers: bob.authHeaders,
  });

  const aliceView = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: alice.authHeaders })).body,
  );
  const bobView = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: bob.authHeaders })).body,
  );

  for (const battles of [aliceView.battles, bobView.battles]) {
    assert.equal(battles.length, 1);
    assert.equal(battles[0].fromName, '앨리스');
    assert.equal(battles[0].targetScore, 30);
    assert.equal(battles[0].toName, '밥');
    assert.equal(battles[0].resultScore, 70);
    assert.equal(battles[0].winner, 'to');
  }

  await app.close();
});

test('a score the recipient posted before the challenge does not count toward it', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('선점덱', alice.userId);
  await insertWords(deck.id, wordList(20), alice.userId);
  await app.inject({
    method: 'POST',
    url: `/api/decks/${deck.id}/share`,
    headers: alice.authHeaders,
  });

  // Bob smashes the deck BEFORE any challenge exists.
  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 10, total: 10 },
    headers: bob.authHeaders,
  });

  // Alice sets a modest target and challenges Bob.
  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 3, total: 10 },
    headers: alice.authHeaders,
  });
  await app.inject({
    method: 'POST',
    url: '/api/challenges',
    payload: { deckId: deck.id, toUserId: bob.userId },
    headers: alice.authHeaders,
  });

  const bobView = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: bob.authHeaders })).body,
  );
  assert.equal(bobView.received.length, 1, 'the challenge is still pending — the old score does not count');
  assert.equal(bobView.battles.length, 0, 'no battle result from a pre-challenge score');

  // Now Bob actually plays for the challenge and wins it.
  await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 9, total: 10 },
    headers: bob.authHeaders,
  });
  const afterPlay = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/challenges', headers: bob.authHeaders })).body,
  );
  assert.equal(afterPlay.received.length, 0, 'beating the target after the challenge clears it');
  assert.equal(afterPlay.battles.length, 1);
  assert.equal(afterPlay.battles[0].winner, 'to');

  await app.close();
});

test('cannot challenge someone using a deck you have no access to', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const carol = await registerTestUser(app, { name: '캐롤' });
  const deck = await createDeck('비공개덱', alice.userId);
  await insertWords(deck.id, wordList(20), alice.userId);
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
