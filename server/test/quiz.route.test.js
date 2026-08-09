import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';
import { createDeck } from '../src/models/decks.js';
import { insertWords } from '../src/models/words.js';

const TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/eng_quiz_test';

before(async () => {
  await connectMongo(TEST_URI);
});

beforeEach(async () => {
  const db = getDb();
  await db.collection('decks').deleteMany({});
  await db.collection('words').deleteMany({});
});

after(async () => {
  await closeMongo();
});

test('GET /api/quiz returns meaning-only questions clamped to available word count', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const deck = await createDeck('퀴즈덱');
  await insertWords(deck.id, [
    { word: 'one', meaning: '하나' },
    { word: 'two', meaning: '둘' },
  ]);

  const response = await app.inject({
    method: 'GET',
    url: `/api/quiz?deckId=${deck.id}&count=10`,
  });
  const body = JSON.parse(response.body);

  assert.equal(body.length, 2);
  assert.ok(body[0].wordId);
  assert.ok(body[0].meaning);
  assert.equal(body[0].word, undefined);

  await app.close();
});

test('POST /api/quiz/check grades exact and close answers', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const deck = await createDeck('퀴즈덱2');
  const [word] = await insertWords(deck.id, [{ word: 'apple', meaning: '사과' }]);

  const correctResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'apple' },
  });
  assert.deepEqual(JSON.parse(correctResponse.body), {
    result: 'correct',
    correctSpelling: 'apple',
  });

  const closeResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'aple' },
  });
  assert.equal(JSON.parse(closeResponse.body).result, 'close');

  await app.close();
});

test('POST /api/quiz/check grades a wrong answer and returns 404 for unknown word', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const deck = await createDeck('퀴즈덱3');
  const [word] = await insertWords(deck.id, [{ word: 'banana', meaning: '바나나' }]);

  const wrongResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: word.id, answer: 'zzzzzzzz' },
  });
  assert.equal(JSON.parse(wrongResponse.body).result, 'wrong');

  const notFoundResponse = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: '507f1f77bcf86cd799439011', answer: 'anything' },
  });
  assert.equal(notFoundResponse.statusCode, 404);

  await app.close();
});

test('POST /api/quiz/check returns 404 (not 500) for a malformed wordId', async () => {
  const app = buildApp({ visionExtractor: async () => [] });

  const response = await app.inject({
    method: 'POST',
    url: '/api/quiz/check',
    payload: { wordId: 'not-a-valid-id', answer: 'anything' },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(response.body), { error: '단어를 찾을 수 없습니다' });

  await app.close();
});

test('GET /api/quiz clamps a negative count to a positive default instead of erroring', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const deck = await createDeck('퀴즈덱4');
  await insertWords(deck.id, [{ word: 'grape', meaning: '포도' }]);

  const response = await app.inject({
    method: 'GET',
    url: `/api/quiz?deckId=${deck.id}&count=-5`,
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);

  await app.close();
});
