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
  await db.collection('mistakes').deleteMany({});
});

after(async () => {
  await closeMongo();
});

test('a wrong answer is recorded in the mistake notebook', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('오답덱', userId);
  const [word] = await insertWords(deck.id, [{ word: 'apple', meaning: '사과' }], userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'xxx' },
    headers: authHeaders,
  });

  const response = await app.inject({ method: 'GET', url: '/api/mistakes', headers: authHeaders });
  const body = JSON.parse(response.body);

  assert.equal(body.length, 1);
  assert.equal(body[0].word, 'apple');
  assert.equal(body[0].meaning, '사과');

  await app.close();
});

test('answering correctly afterwards removes the word from the notebook', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('오답덱2', userId);
  const [word] = await insertWords(deck.id, [{ word: 'grape', meaning: '포도' }], userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'xxx' },
    headers: authHeaders,
  });
  await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'grape' },
    headers: authHeaders,
  });

  const response = await app.inject({ method: 'GET', url: '/api/mistakes', headers: authHeaders });
  assert.deepEqual(JSON.parse(response.body), []);

  await app.close();
});

test('a close (typo) answer also clears the mistake instead of recording it', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('오답덱3', userId);
  const [word] = await insertWords(deck.id, [{ word: 'banana', meaning: '바나나' }], userId);

  const response = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'bananna' },
    headers: authHeaders,
  });
  assert.equal(JSON.parse(response.body).result, 'close');

  const list = await app.inject({ method: 'GET', url: '/api/mistakes', headers: authHeaders });
  assert.deepEqual(JSON.parse(list.body), []);

  await app.close();
});

test('GET /api/quiz?source=mistakes quizzes only on the notebook words', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deckA = await createDeck('덱A', userId);
  const deckB = await createDeck('덱B', userId);
  const [wordA] = await insertWords(deckA.id, [{ word: 'one', meaning: '하나' }], userId);
  await insertWords(deckB.id, [{ word: 'two', meaning: '둘' }], userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: wordA.id, answer: 'xxx' },
    headers: authHeaders,
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/quiz?source=mistakes',
    headers: authHeaders,
  });
  const body = JSON.parse(response.body);

  assert.equal(body.length, 1);
  assert.equal(body[0].wordId, wordA.id);
  assert.equal(body[0].meaning, '하나');

  await app.close();
});

test('GET /api/mistakes returns 401 without a token', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const response = await app.inject({ method: 'GET', url: '/api/mistakes' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('deleting a deck also clears its words from the mistake notebook', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('삭제될덱', userId);
  const [word] = await insertWords(deck.id, [{ word: 'melon', meaning: '멜론' }], userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'xxx' },
    headers: authHeaders,
  });

  await app.inject({ method: 'DELETE', url: `/api/decks/${deck.id}`, headers: authHeaders });

  const response = await app.inject({ method: 'GET', url: '/api/mistakes', headers: authHeaders });
  assert.deepEqual(JSON.parse(response.body), []);

  await app.close();
});

test('GET /api/mistakes/:wordId/example generates and caches a sentence', async () => {
  let callCount = 0;
  const app = buildApp({
    visionExtractor: async () => [],
    sentenceGenerator: async (word) => {
      callCount += 1;
      return `This is a sentence about ${word}.`;
    },
  });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('예문덱', userId);
  const [word] = await insertWords(deck.id, [{ word: 'orbit', meaning: '궤도' }], userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'xxx' },
    headers: authHeaders,
  });

  const first = await app.inject({
    method: 'GET',
    url: `/api/mistakes/${word.id}/example`,
    headers: authHeaders,
  });
  assert.equal(first.statusCode, 200);
  assert.equal(JSON.parse(first.body).sentence, 'This is a sentence about orbit.');
  assert.equal(callCount, 1);

  const second = await app.inject({
    method: 'GET',
    url: `/api/mistakes/${word.id}/example`,
    headers: authHeaders,
  });
  assert.equal(second.statusCode, 200);
  assert.equal(JSON.parse(second.body).sentence, 'This is a sentence about orbit.');
  assert.equal(callCount, 1, 'a cached sentence should not call the generator again');

  await app.close();
});

test('GET /api/mistakes/:wordId/example returns 404 for a word not in your notebook', async () => {
  const app = buildApp({ visionExtractor: async () => [], sentenceGenerator: async () => 'x' });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('예문덱2', userId);
  const [word] = await insertWords(deck.id, [{ word: 'calm', meaning: '차분한' }], userId);

  const response = await app.inject({
    method: 'GET',
    url: `/api/mistakes/${word.id}/example`,
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

test('GET /api/mistakes/:wordId/example returns 500 when the generator fails', async () => {
  const app = buildApp({
    visionExtractor: async () => [],
    sentenceGenerator: async () => {
      throw new Error('boom');
    },
  });
  const { userId, authHeaders } = await registerTestUser(app);
  const deck = await createDeck('예문덱3', userId);
  const [word] = await insertWords(deck.id, [{ word: 'spark', meaning: '불꽃' }], userId);

  await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'xxx' },
    headers: authHeaders,
  });

  const response = await app.inject({
    method: 'GET',
    url: `/api/mistakes/${word.id}/example`,
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 500);

  await app.close();
});
