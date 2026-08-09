import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import FormData from 'form-data';
import { buildApp } from '../src/app.js';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';

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

test('POST /api/decks creates a deck from an uploaded image', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'apple', meaning: '사과' }] });

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'test.png',
    contentType: 'image/png',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: form.getHeaders(),
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.name, 'test');
  assert.equal(body.words.length, 1);
  assert.equal(body.words[0].word, 'apple');

  await app.close();
});

test('POST /api/decks returns 422 when no words extracted', async () => {
  const app = buildApp({ visionExtractor: async () => [] });

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'empty.png',
    contentType: 'image/png',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: form.getHeaders(),
  });

  assert.equal(response.statusCode, 422);
  await app.close();
});

test('GET /api/decks lists created decks and DELETE removes them', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'cat', meaning: '고양이' }] });

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'cat.png',
    contentType: 'image/png',
  });
  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: form.getHeaders(),
  });
  const created = JSON.parse(createResponse.body);

  const listResponse = await app.inject({ method: 'GET', url: '/api/decks' });
  const list = JSON.parse(listResponse.body);
  assert.equal(list.length, 1);
  assert.equal(list[0].wordCount, 1);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/decks/${created.id}`,
  });
  assert.equal(deleteResponse.statusCode, 204);

  const listAfterDelete = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/decks' })).body,
  );
  assert.equal(listAfterDelete.length, 0);

  await app.close();
});
