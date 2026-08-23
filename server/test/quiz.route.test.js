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

test('GET /api/quiz returns meaning-only questions clamped to available word count', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('퀴즈덱', userId);
  await insertWords(
    deck.id,
    [
      { word: 'one', meaning: '하나' },
      { word: 'two', meaning: '둘' },
    ],
    userId,
  );

  const response = await app.inject({
    method: 'GET',
    url: `/api/quiz?deckId=${deck.id}&count=10`,
    headers: authHeaders,
  });
  const body = JSON.parse(response.body);

  assert.equal(body.length, 2);
  assert.ok(body[0].wordId);
  assert.ok(body[0].meaning);
  assert.equal(body[0].word, undefined);

  await app.close();
});

test('GET /api/quiz returns 401 without a token', async () => {
  const app = buildApp({ visionExtractor: async () => [] });

  const response = await app.inject({ method: 'GET', url: '/api/quiz' });
  assert.equal(response.statusCode, 401);

  await app.close();
});

test('POST /api/quiz/check grades exact and close answers', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('퀴즈덱2', userId);
  const [word] = await insertWords(deck.id, [{ word: 'apple', meaning: '사과' }], userId);

  const correctResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'apple' },
    headers: authHeaders,
  });
  assert.deepEqual(JSON.parse(correctResponse.body), {
    result: 'correct',
    correctSpelling: 'apple',
  });

  const closeResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'aple' },
    headers: authHeaders,
  });
  assert.equal(JSON.parse(closeResponse.body).result, 'close');

  await app.close();
});

test('POST /api/quiz/check grades a wrong answer and returns 404 for unknown word', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('퀴즈덱3', userId);
  const [word] = await insertWords(deck.id, [{ word: 'banana', meaning: '바나나' }], userId);

  const wrongResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'zzzzzzzz' },
    headers: authHeaders,
  });
  assert.equal(JSON.parse(wrongResponse.body).result, 'wrong');

  const notFoundResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: '507f1f77bcf86cd799439011', answer: 'anything' },
    headers: authHeaders,
  });
  assert.equal(notFoundResponse.statusCode, 404);

  await app.close();
});

test('POST /api/quiz/check returns 404 (not 500) for a malformed wordId', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { authHeaders } = await registerTestUser(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: 'not-a-valid-id', answer: 'anything' },
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(response.body), { error: '단어를 찾을 수 없습니다' });

  await app.close();
});

test('POST /api/quiz/check returns 404 for a word owned by another user', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const owner = await registerTestUser(app);
  const other = await registerTestUser(app);
  const deck = await createDeck('퀴즈덱-소유', owner.userId);
  const [word] = await insertWords(deck.id, [{ word: 'secret', meaning: '비밀' }], owner.userId);

  const response = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'secret' },
    headers: other.authHeaders,
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

test('a shared deck is quizzable and checkable by another user', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const owner = await registerTestUser(app);
  const viewer = await registerTestUser(app);
  const deck = await createDeck('공유덱', owner.userId);
  const [word] = await insertWords(deck.id, [{ word: 'share', meaning: '공유' }], owner.userId);

  const beforeShare = await app.inject({
    method: 'GET',
    url: `/api/quiz?deckId=${deck.id}`,
    headers: viewer.authHeaders,
  });
  assert.equal(beforeShare.statusCode, 404);

  await app.inject({
    method: 'POST',
    url: `/api/decks/${deck.id}/share`,
    headers: owner.authHeaders,
  });

  const afterShare = await app.inject({
    method: 'GET',
    url: `/api/quiz?deckId=${deck.id}`,
    headers: viewer.authHeaders,
  });
  assert.equal(afterShare.statusCode, 200);
  const questions = JSON.parse(afterShare.body);
  assert.equal(questions.length, 1);

  const checkResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'share' },
    headers: viewer.authHeaders,
  });
  assert.equal(checkResponse.statusCode, 200);
  assert.equal(JSON.parse(checkResponse.body).result, 'correct');

  await app.close();
});

test('POST /api/quiz/results records a score for an accessible deck', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('결과덱', userId);
  await insertWords(deck.id, [{ word: 'grape', meaning: '포도' }], userId);

  const response = await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 7, total: 10 },
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { score: 70, correct: 7, total: 10 });

  await app.close();
});

test('POST /api/quiz/results returns 404 for a deck you cannot access', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const owner = await registerTestUser(app);
  const other = await registerTestUser(app);
  const deck = await createDeck('비공개결과덱', owner.userId);
  await insertWords(deck.id, [{ word: 'grape', meaning: '포도' }], owner.userId);

  const response = await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: deck.id, correct: 1, total: 1 },
    headers: other.authHeaders,
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

test('POST /api/quiz/results returns 400 for a malformed payload', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { authHeaders } = await registerTestUser(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/quiz/results',
    payload: { deckId: 'not-real', correct: 'seven', total: 10 },
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 400);

  await app.close();
});

test('GET /api/quiz clamps a negative count to a positive default instead of erroring', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('퀴즈덱4', userId);
  await insertWords(deck.id, [{ word: 'grape', meaning: '포도' }], userId);

  const response = await app.inject({
    method: 'GET',
    url: `/api/quiz?deckId=${deck.id}&count=-5`,
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);

  await app.close();
});
