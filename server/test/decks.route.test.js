import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import FormData from 'form-data';
import { ObjectId } from 'mongodb';
import { buildApp } from '../src/app.js';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';
import { registerTestUser } from './testUtils.js';
import { createDeck } from '../src/models/decks.js';

const TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/eng_quiz_test';

before(async () => {
  await connectMongo(TEST_URI);
});

beforeEach(async () => {
  const db = getDb();
  await db.collection('decks').deleteMany({});
  await db.collection('words').deleteMany({});
  await db.collection('users').deleteMany({});
});

after(async () => {
  await closeMongo();
});

test('POST /api/decks creates a deck from an uploaded image', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'apple', meaning: '사과' }] });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'test.png',
    contentType: 'image/png',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.match(body.name, /^\d{4}-\d{2}-\d{2} 단어장 1 \(1개\)$/);
  assert.equal(body.words.length, 1);
  assert.equal(body.words[0].word, 'apple');

  await app.close();
});

test('POST /api/decks returns 401 without a token', async () => {
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

  assert.equal(response.statusCode, 401);

  await app.close();
});

test('POST /api/decks returns 422 when no words extracted', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'empty.png',
    contentType: 'image/png',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 422);
  await app.close();
});

test('POST /api/decks returns 400 when no file is uploaded', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'apple', meaning: '사과' }] });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.ok(body.error);

  await app.close();
});

test('POST /api/decks returns 500 when the vision extractor throws', async () => {
  const app = buildApp({
    visionExtractor: async () => {
      throw new Error('boom');
    },
  });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'test.png',
    contentType: 'image/png',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 500);
  const body = JSON.parse(response.body);
  assert.ok(body.error);
  assert.notEqual(body.error, 'boom');

  await app.close();
});

test('POST /api/decks returns 413 with a Korean error message when the file exceeds 10MB', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'apple', meaning: '사과' }] });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.alloc(11 * 1024 * 1024), {
    filename: 'huge.png',
    contentType: 'image/png',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 413);
  const body = JSON.parse(response.body);
  assert.ok(body.error);
  assert.ok(!/^[\x00-\x7F]*$/.test(body.error), 'expected a non-English (Korean) error message');

  await app.close();
});

test('DELETE /api/decks/:id returns 404 when the deck does not exist', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { authHeaders } = await registerTestUser(app);

  const missingId = new ObjectId().toString();

  const response = await app.inject({
    method: 'DELETE',
    url: `/api/decks/${missingId}`,
    headers: authHeaders,
  });

  assert.equal(response.statusCode, 404);
  const body = JSON.parse(response.body);
  assert.ok(body.error);

  await app.close();
});

test('GET /api/decks lists created decks and DELETE removes them', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'cat', meaning: '고양이' }] });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'cat.png',
    contentType: 'image/png',
  });
  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });
  const created = JSON.parse(createResponse.body);

  const listResponse = await app.inject({ method: 'GET', url: '/api/decks', headers: authHeaders });
  const list = JSON.parse(listResponse.body);
  assert.equal(list.items.length, 1);
  assert.equal(list.total, 1);
  assert.equal(list.items[0].wordCount, 1);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/decks/${created.id}`,
    headers: authHeaders,
  });
  assert.equal(deleteResponse.statusCode, 204);

  const listAfterDelete = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/decks', headers: authHeaders })).body,
  );
  assert.equal(listAfterDelete.items.length, 0);

  await app.close();
});

test('a deck created by one user is invisible to another user', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'cat', meaning: '고양이' }] });
  const userA = await registerTestUser(app);
  const userB = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'cat.png',
    contentType: 'image/png',
  });
  await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...userA.authHeaders },
  });

  const listAsB = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/decks', headers: userB.authHeaders })).body,
  );
  assert.equal(listAsB.items.length, 0);

  await app.close();
});

test('sharing a deck makes it visible to other users with the owner name attached', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'cat', meaning: '고양이' }] });
  const owner = await registerTestUser(app, { name: '공유자' });
  const viewer = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'cat.png',
    contentType: 'image/png',
  });
  const created = JSON.parse(
    (
      await app.inject({
        method: 'POST',
        url: '/api/decks',
        payload: form,
        headers: { ...form.getHeaders(), ...owner.authHeaders },
      })
    ).body,
  );

  const beforeShare = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/decks', headers: viewer.authHeaders })).body,
  );
  assert.equal(beforeShare.items.length, 0);

  const shareResponse = await app.inject({
    method: 'POST',
    url: `/api/decks/${created.id}/share`,
    headers: owner.authHeaders,
  });
  assert.equal(shareResponse.statusCode, 200);

  const afterShare = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/decks', headers: viewer.authHeaders })).body,
  );
  assert.equal(afterShare.items.length, 1);
  assert.equal(afterShare.items[0].ownerName, '공유자');

  const wordsResponse = await app.inject({
    method: 'GET',
    url: `/api/decks/${created.id}/words`,
    headers: viewer.authHeaders,
  });
  assert.equal(wordsResponse.statusCode, 200);
  assert.equal(JSON.parse(wordsResponse.body).length, 1);

  await app.close();
});

test('POST /api/decks/:id/share returns 404 for a deck you do not own', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'cat', meaning: '고양이' }] });
  const owner = await registerTestUser(app);
  const other = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'cat.png',
    contentType: 'image/png',
  });
  const created = JSON.parse(
    (
      await app.inject({
        method: 'POST',
        url: '/api/decks',
        payload: form,
        headers: { ...form.getHeaders(), ...owner.authHeaders },
      })
    ).body,
  );

  const response = await app.inject({
    method: 'POST',
    url: `/api/decks/${created.id}/share`,
    headers: other.authHeaders,
  });
  assert.equal(response.statusCode, 404);

  await app.close();
});

test('GET /api/decks paginates with a default page size of 5', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);

  for (let i = 0; i < 10; i += 1) {
    await createDeck(`덱${i}`, userId);
  }

  const firstPage = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/decks', headers: authHeaders })).body,
  );
  assert.equal(firstPage.items.length, 5);
  assert.equal(firstPage.total, 10);
  assert.equal(firstPage.page, 1);
  assert.equal(firstPage.pageSize, 5);
  assert.equal(firstPage.totalPages, 2);

  const secondPage = JSON.parse(
    (
      await app.inject({ method: 'GET', url: '/api/decks?page=2', headers: authHeaders })
    ).body,
  );
  assert.equal(secondPage.items.length, 5);
  assert.equal(secondPage.page, 2);

  const overflowIds = new Set([...firstPage.items, ...secondPage.items].map((d) => d.id));
  assert.equal(overflowIds.size, 10, 'pages should not overlap or duplicate decks');

  await app.close();
});

test('GET /api/decks respects a custom pageSize and clamps out-of-range values', async () => {
  const app = buildApp({ visionExtractor: async () => [] });
  const { userId, authHeaders } = await registerTestUser(app);

  for (let i = 0; i < 5; i += 1) {
    await createDeck(`덱${i}`, userId);
  }

  const customPage = JSON.parse(
    (
      await app.inject({
        method: 'GET',
        url: '/api/decks?page=1&pageSize=3',
        headers: authHeaders,
      })
    ).body,
  );
  assert.equal(customPage.items.length, 3);
  assert.equal(customPage.totalPages, 2);

  const invalidPage = JSON.parse(
    (
      await app.inject({
        method: 'GET',
        url: '/api/decks?page=0&pageSize=-5',
        headers: authHeaders,
      })
    ).body,
  );
  assert.equal(invalidPage.page, 1);
  assert.ok(invalidPage.pageSize >= 1);
  assert.equal(invalidPage.items.length, invalidPage.pageSize);

  await app.close();
});

test('POST /api/decks merges words from multiple images into a single deck', async () => {
  const app = buildApp({
    visionExtractor: async (base64) => {
      if (base64 === Buffer.from('page-one').toString('base64')) {
        return [{ word: 'apple', meaning: '사과' }];
      }
      return [{ word: 'banana', meaning: '바나나' }];
    },
  });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('page-one'), { filename: 'p1.png', contentType: 'image/png' });
  form.append('file', Buffer.from('page-two'), { filename: 'p2.png', contentType: 'image/png' });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.match(body.name, /^\d{4}-\d{2}-\d{2} 단어장 1 \(2개\)$/);
  assert.deepEqual(
    body.words.map((w) => w.word).sort(),
    ['apple', 'banana'],
  );

  await app.close();
});

test('POST /api/decks skips a failing image and still builds the deck from the rest', async () => {
  const app = buildApp({
    visionExtractor: async (base64) => {
      if (base64 === Buffer.from('bad-page').toString('base64')) {
        throw new Error('vision boom');
      }
      return [{ word: 'grape', meaning: '포도' }];
    },
  });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('good-page'), { filename: 'good.png', contentType: 'image/png' });
  form.append('file', Buffer.from('bad-page'), { filename: 'bad.png', contentType: 'image/png' });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.words.length, 1);
  assert.equal(body.words[0].word, 'grape');

  await app.close();
});

test('POST /api/decks returns 500 when every image in a multi-image upload fails', async () => {
  const app = buildApp({
    visionExtractor: async () => {
      throw new Error('vision boom');
    },
  });
  const { authHeaders } = await registerTestUser(app);

  const form = new FormData();
  form.append('file', Buffer.from('bad-one'), { filename: 'bad1.png', contentType: 'image/png' });
  form.append('file', Buffer.from('bad-two'), { filename: 'bad2.png', contentType: 'image/png' });

  const response = await app.inject({
    method: 'POST',
    url: '/api/decks',
    payload: form,
    headers: { ...form.getHeaders(), ...authHeaders },
  });

  assert.equal(response.statusCode, 500);

  await app.close();
});

test('POST /api/decks names decks by that day\'s sequence number, per user', async () => {
  const app = buildApp({ visionExtractor: async () => [{ word: 'apple', meaning: '사과' }] });
  const { authHeaders: userAHeaders } = await registerTestUser(app);
  const { authHeaders: userBHeaders } = await registerTestUser(app);

  async function upload(headers) {
    const form = new FormData();
    form.append('file', Buffer.from('img'), { filename: 'x.png', contentType: 'image/png' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/decks',
      payload: form,
      headers: { ...form.getHeaders(), ...headers },
    });
    return JSON.parse(response.body).name;
  }

  const first = await upload(userAHeaders);
  const second = await upload(userAHeaders);
  const otherUserFirst = await upload(userBHeaders);

  assert.match(first, /^\d{4}-\d{2}-\d{2} 단어장 1 \(1개\)$/);
  assert.match(second, /^\d{4}-\d{2}-\d{2} 단어장 2 \(1개\)$/);
  assert.match(otherUserFirst, /^\d{4}-\d{2}-\d{2} 단어장 1 \(1개\)$/);

  await app.close();
});
