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
});

after(async () => {
  await closeMongo();
});

async function playQuiz(app, authHeaders, deckId, correct, total) {
  return app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId, correct, total },
    headers: authHeaders,
  });
}

test('GET /api/rankings/weekly ranks users by their best score this week', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('랭킹덱', alice.userId);
  await insertWords(deck.id, [{ word: 'a', meaning: 'ㄱ' }], alice.userId);
  await app.inject({
    method: 'POST',
    url: `/api/decks/${deck.id}/share`,
    headers: alice.authHeaders,
  });

  await playQuiz(app, alice.authHeaders, deck.id, 5, 10);
  await playQuiz(app, alice.authHeaders, deck.id, 9, 10);
  await playQuiz(app, bob.authHeaders, deck.id, 6, 10);

  const response = await app.inject({ method: 'GET', url: '/api/rankings/weekly', headers: alice.authHeaders });
  assert.equal(response.statusCode, 200);
  const board = JSON.parse(response.body);

  assert.equal(board[0].name, '앨리스');
  assert.equal(board[0].bestCorrect, 9);
  assert.equal(board[0].bestTotal, 10);
  assert.equal(board[0].bestScore, 90);
  assert.equal(board[0].quizCount, 2);
  assert.equal(board[1].name, '밥');
  assert.equal(board[1].bestCorrect, 6);
  assert.equal(board[1].bestScore, 60);

  await app.close();
});

test('a lower-percentage result with more correct answers outranks a small perfect score', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('랭킹덱2', alice.userId);
  await insertWords(deck.id, [{ word: 'a', meaning: 'ㄱ' }], alice.userId);
  await app.inject({ method: 'POST', url: `/api/decks/${deck.id}/share`, headers: alice.authHeaders });

  // Bob: 1/1 = 100% but only one correct answer.
  await playQuiz(app, bob.authHeaders, deck.id, 1, 1);
  // Alice: 19/20 = 95% but many more correct answers.
  await playQuiz(app, alice.authHeaders, deck.id, 19, 20);

  const response = await app.inject({ method: 'GET', url: '/api/rankings/weekly', headers: alice.authHeaders });
  const board = JSON.parse(response.body);

  assert.equal(board[0].name, '앨리스', '19 correct answers should outrank 1, despite the lower percentage');
  assert.equal(board[0].bestCorrect, 19);
  assert.equal(board[1].name, '밥');
  assert.equal(board[1].bestCorrect, 1);

  await app.close();
});

test('ties on correct count are broken by whoever attempted more questions', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const alice = await registerTestUser(app, { name: '앨리스' });
  const bob = await registerTestUser(app, { name: '밥' });
  const deck = await createDeck('랭킹덱3', alice.userId);
  await insertWords(deck.id, [{ word: 'a', meaning: 'ㄱ' }], alice.userId);
  await app.inject({ method: 'POST', url: `/api/decks/${deck.id}/share`, headers: alice.authHeaders });

  // Both got 15 correct, but Alice attempted more questions to get there.
  await playQuiz(app, bob.authHeaders, deck.id, 15, 15);
  await playQuiz(app, alice.authHeaders, deck.id, 15, 20);

  const response = await app.inject({ method: 'GET', url: '/api/rankings/weekly', headers: alice.authHeaders });
  const board = JSON.parse(response.body);

  assert.equal(board[0].name, '앨리스');
  assert.equal(board[0].bestTotal, 20);
  assert.equal(board[1].name, '밥');
  assert.equal(board[1].bestTotal, 15);

  await app.close();
});

test('GET /api/rankings/weekly returns 401 without a token', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const response = await app.inject({ method: 'GET', url: '/api/rankings/weekly' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('GET /api/rankings/weekly returns an empty list when nobody has played', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { authHeaders } = await registerTestUser(app);

  const response = await app.inject({ method: 'GET', url: '/api/rankings/weekly', headers: authHeaders });
  assert.deepEqual(JSON.parse(response.body), []);

  await app.close();
});
