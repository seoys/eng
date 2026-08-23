import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';

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

test('POST /api/auth creates a new user on first sign-in', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth',
    payload: { name: '홍길동', birthDate: '1999-05-01', password: 'secret1' },
  });

  assert.equal(response.statusCode, 201);
  const body = JSON.parse(response.body);
  assert.ok(body.token);
  assert.equal(body.user.name, '홍길동');

  await app.close();
});

test('POST /api/auth logs an existing user back in with the right password', async () => {
  const app = buildApp();
  const payload = { name: '김철수', birthDate: '1995-03-03', password: 'secret1' };

  await app.inject({ method: 'POST', url: '/api/auth', payload });
  const response = await app.inject({ method: 'POST', url: '/api/auth', payload });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.ok(body.token);

  await app.close();
});

test('POST /api/auth rejects the wrong password for an existing user', async () => {
  const app = buildApp();

  await app.inject({
    method: 'POST',
    url: '/api/auth',
    payload: { name: '이영희', birthDate: '2001-07-07', password: 'correct-pw' },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth',
    payload: { name: '이영희', birthDate: '2001-07-07', password: 'wrong-pw' },
  });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test('POST /api/auth returns 400 when a field is missing', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth',
    payload: { name: '박영수', birthDate: '', password: 'secret1' },
  });

  assert.equal(response.statusCode, 400);

  await app.close();
});

test('a token from one user is rejected by a request scoped to another', async () => {
  const app = buildApp();

  const userA = await app.inject({
    method: 'POST',
    url: '/api/auth',
    payload: { name: '유저A', birthDate: '1990-01-01', password: 'secret1' },
  });
  const tokenA = JSON.parse(userA.body).token;

  const protectedResponse = await app.inject({
    method: 'GET',
    url: '/api/decks',
    headers: { authorization: `Bearer ${tokenA}` },
  });

  assert.equal(protectedResponse.statusCode, 200);

  const noTokenResponse = await app.inject({ method: 'GET', url: '/api/decks' });
  assert.equal(noTokenResponse.statusCode, 401);

  await app.close();
});
