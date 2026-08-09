# English Word Image Quiz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal web app where uploading an image of English words extracts `{word, meaning}` pairs via Claude Vision, stores them in MongoDB, and quizzes the user with a spelling-recall quiz.

**Architecture:** Monorepo with a Fastify REST API (`server/`) backed by MongoDB and an Anthropic-compatible Vision API, and a Svelte SPA (`web/`) that talks to it over `/api`. No auth, single user.

**Tech Stack:** Node.js 22 LTS, Fastify 5, `mongodb` driver (no ORM), `@anthropic-ai/sdk`, `@fastify/multipart`, `@fastify/cors`, Node's built-in `node:test` runner, Vite + Svelte.

## Global Constraints

- Node.js 22 LTS only (per spec's "기술 스택 버전" section).
- MVP scope only: no login/multi-user, no multiple-choice questions, no spaced-repetition/wrong-answer review (per spec's "범위" section). Do not add these.
- Grading has exactly three states: `correct` (exact match), `close` (Levenshtein distance ≤ 2, counts as correct for scoring), `wrong` (per spec's "문제 유형" section).
- All API error responses use the shape `{ "error": "<message>" }` with an appropriate HTTP status code (per spec's "API 엔드포인트" section).
- Backend integration tests require a local MongoDB instance. Use `MONGODB_TEST_URI` (default `mongodb://localhost:27017/eng_quiz_test`) so tests never touch the dev database.
- Vision extraction must use Claude's forced tool-use (structured output), not free-text JSON parsing (per spec's note on preferring structured output).
- Deck naming: uploaded filename without extension, falling back to `YYYY-MM-DD 단어장` when no filename is available.

---

## Task 1: Server scaffold and health check

**Files:**
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `server/src/app.js`
- Create: `server/src/server.js`
- Test: `server/test/health.test.js`

**Interfaces:**
- Produces: `buildApp()` — returns a Fastify instance with `GET /health` registered. Later tasks change this signature to `buildApp({ visionExtractor })`.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "eng-quiz-server",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/multipart": "^9.0.0",
    "dotenv": "^16.4.0",
    "fastify": "^5.0.0",
    "mongodb": "^6.9.0"
  },
  "devDependencies": {
    "form-data": "^4.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd server && npm install
```

- [ ] **Step 3: Create `server/.env.example`**

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/eng_quiz
ANTHROPIC_API_KEY=your-proxy-api-key
ANTHROPIC_BASE_URL=https://api.syterolink.com
ANTHROPIC_MODEL=claude-sonnet-4-5
```

- [ ] **Step 4: Write the failing health check test**

Create `server/test/health.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('GET /health returns ok status', async () => {
  const app = buildApp();
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  await app.close();
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd server && node --test test/health.test.js`
Expected: FAIL — cannot find module `../src/app.js`

- [ ] **Step 6: Create `server/src/app.js`**

```js
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 7: Create `server/src/server.js`**

```js
import 'dotenv/config';
import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.PORT) || 3000;

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && node --test test/health.test.js`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/.env.example server/src/app.js server/src/server.js server/test/health.test.js
git commit -m "feat(server): scaffold Fastify app with health check"
```

---

## Task 2: Grading module (Levenshtein-based)

**Files:**
- Create: `server/src/services/grading.js`
- Test: `server/test/grading.test.js`

**Interfaces:**
- Produces: `levenshteinDistance(a: string, b: string): number`, `gradeAnswer(correctWord: string, userAnswer: string): 'correct' | 'close' | 'wrong'`. Used by Task 6 (quiz check route).

- [ ] **Step 1: Write the failing tests**

Create `server/test/grading.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, levenshteinDistance } from '../src/services/grading.js';

test('levenshteinDistance computes edit distance', () => {
  assert.equal(levenshteinDistance('apple', 'apple'), 0);
  assert.equal(levenshteinDistance('aple', 'apple'), 1);
  assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
});

test('gradeAnswer returns correct for exact match (case/whitespace insensitive)', () => {
  assert.equal(gradeAnswer('apple', 'Apple'), 'correct');
  assert.equal(gradeAnswer('apple', '  apple  '), 'correct');
});

test('gradeAnswer returns close for a minor typo within distance 2', () => {
  assert.equal(gradeAnswer('apple', 'aple'), 'close');
  assert.equal(gradeAnswer('banana', 'banan'), 'close');
});

test('gradeAnswer returns wrong for very different input', () => {
  assert.equal(gradeAnswer('apple', 'orange'), 'wrong');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test test/grading.test.js`
Expected: FAIL — cannot find module `../src/services/grading.js`

- [ ] **Step 3: Implement `server/src/services/grading.js`**

```js
export function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

const CLOSE_DISTANCE_THRESHOLD = 2;

export function gradeAnswer(correctWord, userAnswer) {
  const normalizedCorrect = correctWord.trim().toLowerCase();
  const normalizedAnswer = userAnswer.trim().toLowerCase();

  if (normalizedAnswer === normalizedCorrect) return 'correct';

  const distance = levenshteinDistance(normalizedAnswer, normalizedCorrect);
  return distance <= CLOSE_DISTANCE_THRESHOLD ? 'close' : 'wrong';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test test/grading.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/grading.js server/test/grading.test.js
git commit -m "feat(server): add Levenshtein-based answer grading"
```

---

## Task 3: MongoDB connection and Deck/Word data access

**Files:**
- Create: `server/src/db/mongo.js`
- Create: `server/src/models/decks.js`
- Create: `server/src/models/words.js`
- Test: `server/test/models.test.js`

**Interfaces:**
- Produces:
  - `connectMongo(uri: string): Promise<Db>`, `getDb(): Db`, `closeMongo(): Promise<void>`
  - `createDeck(name: string): Promise<{id, name, createdAt}>`, `listDecks(): Promise<{id, name, wordCount, createdAt}[]>`, `deleteDeck(id: string): Promise<boolean>`
  - `insertWords(deckId: string, words: {word, meaning}[]): Promise<{id, word, meaning}[]>`, `getWordsByDeck(deckId: string): Promise<{id, word, meaning}[]>`, `getWordById(id: string): Promise<{id, word, meaning, deckId} | null>`, `getRandomWords(deckId: string | undefined, count: number): Promise<{wordId, meaning}[]>`

- [ ] **Step 1: Create `server/src/db/mongo.js`**

```js
import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectMongo(uri) {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

export function getDb() {
  if (!db) throw new Error('MongoDB not connected. Call connectMongo() first.');
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
```

- [ ] **Step 2: Create `server/src/models/decks.js`**

```js
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('decks');
}

export async function createDeck(name) {
  const doc = { name, createdAt: new Date() };
  const { insertedId } = await collection().insertOne(doc);
  return { id: insertedId.toString(), ...doc };
}

export async function listDecks() {
  const wordsCol = getDb().collection('words');
  const decks = await collection().find().sort({ createdAt: -1 }).toArray();

  return Promise.all(
    decks.map(async (deck) => {
      const wordCount = await wordsCol.countDocuments({ deckId: deck._id });
      return {
        id: deck._id.toString(),
        name: deck.name,
        wordCount,
        createdAt: deck.createdAt,
      };
    }),
  );
}

export async function deleteDeck(id) {
  const deckId = new ObjectId(id);
  await getDb().collection('words').deleteMany({ deckId });
  const { deletedCount } = await collection().deleteOne({ _id: deckId });
  return deletedCount > 0;
}
```

- [ ] **Step 3: Create `server/src/models/words.js`**

```js
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('words');
}

export async function insertWords(deckId, words) {
  const docs = words.map(({ word, meaning }) => ({
    deckId: new ObjectId(deckId),
    word,
    meaning,
    createdAt: new Date(),
  }));
  const { insertedIds } = await collection().insertMany(docs);
  return docs.map((doc, index) => ({
    id: insertedIds[index].toString(),
    word: doc.word,
    meaning: doc.meaning,
  }));
}

export async function getWordsByDeck(deckId) {
  const docs = await collection().find({ deckId: new ObjectId(deckId) }).toArray();
  return docs.map((doc) => ({ id: doc._id.toString(), word: doc.word, meaning: doc.meaning }));
}

export async function getWordById(id) {
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    word: doc.word,
    meaning: doc.meaning,
    deckId: doc.deckId.toString(),
  };
}

export async function getRandomWords(deckId, count) {
  const filter = deckId ? { deckId: new ObjectId(deckId) } : {};
  const docs = await collection()
    .aggregate([{ $match: filter }, { $sample: { size: count } }])
    .toArray();
  return docs.map((doc) => ({ wordId: doc._id.toString(), meaning: doc.meaning }));
}
```

- [ ] **Step 4: Write integration tests**

Create `server/test/models.test.js`:

```js
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';
import { createDeck, listDecks, deleteDeck } from '../src/models/decks.js';
import {
  insertWords,
  getWordsByDeck,
  getWordById,
  getRandomWords,
} from '../src/models/words.js';

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

test('createDeck and listDecks returns deck with wordCount', async () => {
  const deck = await createDeck('테스트 단어장');
  await insertWords(deck.id, [
    { word: 'apple', meaning: '사과' },
    { word: 'banana', meaning: '바나나' },
  ]);

  const decks = await listDecks();
  assert.equal(decks.length, 1);
  assert.equal(decks[0].name, '테스트 단어장');
  assert.equal(decks[0].wordCount, 2);
});

test('getWordsByDeck returns inserted words', async () => {
  const deck = await createDeck('단어장2');
  await insertWords(deck.id, [{ word: 'cat', meaning: '고양이' }]);

  const words = await getWordsByDeck(deck.id);
  assert.equal(words.length, 1);
  assert.equal(words[0].word, 'cat');
});

test('getWordById returns matching word', async () => {
  const deck = await createDeck('단어장3');
  const [inserted] = await insertWords(deck.id, [{ word: 'dog', meaning: '개' }]);

  const found = await getWordById(inserted.id);
  assert.equal(found.word, 'dog');
});

test('getRandomWords respects count, deck filter, and hides spelling', async () => {
  const deck = await createDeck('단어장4');
  await insertWords(deck.id, [
    { word: 'one', meaning: '하나' },
    { word: 'two', meaning: '둘' },
    { word: 'three', meaning: '셋' },
  ]);

  const sample = await getRandomWords(deck.id, 2);
  assert.equal(sample.length, 2);
  assert.ok(sample[0].meaning);
  assert.equal(sample[0].word, undefined);
});

test('deleteDeck removes deck and its words', async () => {
  const deck = await createDeck('단어장5');
  await insertWords(deck.id, [{ word: 'x', meaning: 'ㅌ' }]);

  const deleted = await deleteDeck(deck.id);
  assert.equal(deleted, true);

  const words = await getWordsByDeck(deck.id);
  assert.equal(words.length, 0);
});
```

- [ ] **Step 5: Run tests (requires local MongoDB running)**

Run: `cd server && node --test test/models.test.js`
Expected: PASS (5 tests). If MongoDB isn't running at `mongodb://localhost:27017`, start it first.

- [ ] **Step 6: Commit**

```bash
git add server/src/db server/src/models server/test/models.test.js
git commit -m "feat(server): add MongoDB connection and deck/word data access"
```

---

## Task 4: Vision extraction service

**Files:**
- Create: `server/src/services/visionExtract.js`
- Test: `server/test/visionExtract.test.js`

**Interfaces:**
- Consumes: an injected Anthropic-SDK-shaped `client` with `client.messages.create(...)`.
- Produces: `createVisionExtractor({ client, model }): (base64: string, mediaType: string) => Promise<{word, meaning}[]>`. Used by Task 5's `server.js` and injected into `buildApp({ visionExtractor })`.

- [ ] **Step 1: Write the failing tests**

Create `server/test/visionExtract.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisionExtractor } from '../src/services/visionExtract.js';

function fakeResponse(words) {
  return {
    content: [{ type: 'tool_use', name: 'extract_words', input: { words } }],
  };
}

test('extractWordsFromImage returns parsed words on success', async () => {
  const client = {
    messages: {
      create: async () => fakeResponse([{ word: 'apple', meaning: '사과' }]),
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'apple', meaning: '사과' }]);
});

test('extractWordsFromImage filters out malformed entries', async () => {
  const client = {
    messages: {
      create: async () =>
        fakeResponse([
          { word: 'apple', meaning: '사과' },
          { word: '', meaning: '빈값' },
          { word: 'cat' },
        ]),
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'apple', meaning: '사과' }]);
});

test('extractWordsFromImage retries once on failure then throws if still failing', async () => {
  let callCount = 0;
  const client = {
    messages: {
      create: async () => {
        callCount += 1;
        throw new Error('network error');
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  await assert.rejects(
    () => extract('base64data', 'image/png'),
    /Vision extraction failed after retry/,
  );
  assert.equal(callCount, 2);
});

test('extractWordsFromImage succeeds on retry after first failure', async () => {
  let callCount = 0;
  const client = {
    messages: {
      create: async () => {
        callCount += 1;
        if (callCount === 1) throw new Error('transient error');
        return fakeResponse([{ word: 'dog', meaning: '개' }]);
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'dog', meaning: '개' }]);
  assert.equal(callCount, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test test/visionExtract.test.js`
Expected: FAIL — cannot find module `../src/services/visionExtract.js`

- [ ] **Step 3: Implement `server/src/services/visionExtract.js`**

```js
const EXTRACT_TOOL = {
  name: 'extract_words',
  description: 'Extract English words and their Korean meanings visible in the image',
  input_schema: {
    type: 'object',
    properties: {
      words: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            word: { type: 'string' },
            meaning: { type: 'string' },
          },
          required: ['word', 'meaning'],
        },
      },
    },
    required: ['words'],
  },
};

function parseToolResponse(response) {
  const toolUseBlock = response.content.find((block) => block.type === 'tool_use');
  if (!toolUseBlock || !Array.isArray(toolUseBlock.input?.words)) {
    throw new Error('No valid tool_use block with words array found in response');
  }

  return toolUseBlock.input.words.filter(
    (item) =>
      typeof item.word === 'string' &&
      item.word.trim() &&
      typeof item.meaning === 'string' &&
      item.meaning.trim(),
  );
}

export function createVisionExtractor({ client, model }) {
  async function callOnce(base64, mediaType) {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_words' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: '이미지 속 영어 단어와 그에 대응하는 한글 뜻을 모두 찾아서 extract_words 도구를 호출해줘.',
            },
          ],
        },
      ],
    });

    return parseToolResponse(response);
  }

  return async function extractWordsFromImage(base64, mediaType) {
    try {
      return await callOnce(base64, mediaType);
    } catch (firstError) {
      try {
        return await callOnce(base64, mediaType);
      } catch (secondError) {
        throw new Error(`Vision extraction failed after retry: ${secondError.message}`);
      }
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test test/visionExtract.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/visionExtract.js server/test/visionExtract.test.js
git commit -m "feat(server): add Claude Vision word extraction with tool-use and retry"
```

---

## Task 5: Deck routes (upload, list, words, delete)

**Files:**
- Create: `server/src/routes/decks.js`
- Modify: `server/src/app.js` (full rewrite — see below)
- Test: `server/test/decks.route.test.js`

**Interfaces:**
- Consumes: `createDeck`, `listDecks`, `deleteDeck` from `../models/decks.js`; `insertWords`, `getWordsByDeck` from `../models/words.js`; `app.visionExtractor` decorator.
- Produces: `buildApp({ visionExtractor })` — new signature. `registerDeckRoutes(app)` — Fastify plugin mounted at `/api/decks`.

- [ ] **Step 1: Create `server/src/routes/decks.js`**

```js
import { createDeck, listDecks, deleteDeck } from '../models/decks.js';
import { insertWords, getWordsByDeck } from '../models/words.js';

export async function registerDeckRoutes(app) {
  app.post('/', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: '이미지 파일이 필요합니다' };
    }

    const buffer = await file.toBuffer();
    const base64 = buffer.toString('base64');
    const mediaType = file.mimetype;

    let extractedWords;
    try {
      extractedWords = await app.visionExtractor(base64, mediaType);
    } catch (error) {
      app.log.error(error);
      reply.code(500);
      return { error: '이미지 분석에 실패했습니다' };
    }

    if (extractedWords.length === 0) {
      reply.code(422);
      return { error: '단어를 찾지 못했습니다' };
    }

    const name = file.filename
      ? file.filename.replace(/\.[^.]+$/, '')
      : `${new Date().toISOString().slice(0, 10)} 단어장`;

    const deck = await createDeck(name);
    const words = await insertWords(deck.id, extractedWords);

    return { id: deck.id, name: deck.name, words };
  });

  app.get('/', async () => listDecks());

  app.get('/:id/words', async (request) => getWordsByDeck(request.params.id));

  app.delete('/:id', async (request, reply) => {
    const deleted = await deleteDeck(request.params.id);
    if (!deleted) {
      reply.code(404);
      return { error: '단어장을 찾을 수 없습니다' };
    }
    reply.code(204);
    return null;
  });
}
```

- [ ] **Step 2: Rewrite `server/src/app.js`**

```js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerDeckRoutes } from './routes/decks.js';

export function buildApp({ visionExtractor } = {}) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart);

  app.decorate('visionExtractor', visionExtractor);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    reply
      .code(statusCode)
      .send({ error: statusCode === 500 ? '서버 오류가 발생했습니다' : error.message });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(registerDeckRoutes, { prefix: '/api/decks' });

  return app;
}
```

- [ ] **Step 3: Write the failing route tests**

Create `server/test/decks.route.test.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd server && npm install && node --test test/decks.route.test.js`
Expected: FAIL — cannot find module `../src/routes/decks.js` (before Step 1/2 are applied; after applying them this becomes the "verify pass" run)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && node --test test/decks.route.test.js`
Expected: PASS (3 tests). Requires local MongoDB running.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/decks.js server/src/app.js server/test/decks.route.test.js server/package.json
git commit -m "feat(server): add deck upload/list/words/delete routes"
```

---

## Task 6: Quiz routes (random questions, answer check)

**Files:**
- Create: `server/src/routes/quiz.js`
- Modify: `server/src/app.js` (add quiz route registration)
- Test: `server/test/quiz.route.test.js`

**Interfaces:**
- Consumes: `getRandomWords`, `getWordById` from `../models/words.js`; `gradeAnswer` from `../services/grading.js`.
- Produces: `registerQuizRoutes(app)` — Fastify plugin mounted at `/api/quiz`.

- [ ] **Step 1: Create `server/src/routes/quiz.js`**

```js
import { getRandomWords, getWordById } from '../models/words.js';
import { gradeAnswer } from '../services/grading.js';

export async function registerQuizRoutes(app) {
  app.get('/', async (request) => {
    const { deckId, count } = request.query;
    const parsedCount = Number.parseInt(count, 10) || 10;
    return getRandomWords(deckId, parsedCount);
  });

  app.post('/check', async (request, reply) => {
    const { wordId, answer } = request.body;
    const word = await getWordById(wordId);
    if (!word) {
      reply.code(404);
      return { error: '단어를 찾을 수 없습니다' };
    }

    const result = gradeAnswer(word.word, answer ?? '');
    return { result, correctSpelling: word.word };
  });
}
```

- [ ] **Step 2: Modify `server/src/app.js`** — add the import and registration

Change:
```js
import { registerDeckRoutes } from './routes/decks.js';
```
to:
```js
import { registerDeckRoutes } from './routes/decks.js';
import { registerQuizRoutes } from './routes/quiz.js';
```

Change:
```js
  app.register(registerDeckRoutes, { prefix: '/api/decks' });

  return app;
```
to:
```js
  app.register(registerDeckRoutes, { prefix: '/api/decks' });
  app.register(registerQuizRoutes, { prefix: '/api/quiz' });

  return app;
```

- [ ] **Step 3: Write the failing route tests**

Create `server/test/quiz.route.test.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd server && node --test test/quiz.route.test.js`
Expected: FAIL — cannot find module `../src/routes/quiz.js` (before Steps 1/2 applied)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && node --test`
Expected: PASS — all test files (health, grading, models, visionExtract, decks.route, quiz.route) pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/quiz.js server/src/app.js server/test/quiz.route.test.js
git commit -m "feat(server): add quiz question and answer-check routes"
```

---

## Task 7: Wire server entry point to Mongo and Anthropic SDK

**Files:**
- Modify: `server/src/server.js` (full rewrite)

**Interfaces:**
- Consumes: `connectMongo` from `../db/mongo.js`, `createVisionExtractor` from `./services/visionExtract.js`, `buildApp` from `./app.js`.

- [ ] **Step 1: Rewrite `server/src/server.js`**

```js
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { buildApp } from './app.js';
import { connectMongo } from './db/mongo.js';
import { createVisionExtractor } from './services/visionExtract.js';

async function main() {
  await connectMongo(process.env.MONGODB_URI);

  const anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });

  const visionExtractor = createVisionExtractor({
    client: anthropicClient,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  });

  const app = buildApp({ visionExtractor });
  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Create `server/.env` from the example and fill in real values**

```bash
cd server && cp .env.example .env
```

Edit `server/.env` to set `MONGODB_URI`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_BASE_URL` to the real proxy values.

- [ ] **Step 3: Manually verify the server boots**

Run: `cd server && npm start`
Expected: log output showing the server listening, then `curl http://localhost:3000/health` returns `{"status":"ok"}`. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server/src/server.js
git commit -m "feat(server): wire Mongo connection and Anthropic client into server entry point"
```

(`.env` is git-ignored — do not commit it.)

---

## Task 8: Svelte scaffold and API client

**Files:**
- Create: `web/` (via Vite scaffold)
- Modify: `web/vite.config.js`
- Create: `web/src/lib/api.js`

**Interfaces:**
- Produces: `uploadDeck(file)`, `fetchDecks()`, `deleteDeck(deckId)`, `fetchQuiz(deckId, count)`, `checkAnswer(wordId, answer)` — all `async`, all throw `Error` with a Korean message on failure. Used by Tasks 9–12.

- [ ] **Step 1: Scaffold the Svelte project**

```bash
npm create vite@latest web -- --template svelte
cd web && npm install
```

- [ ] **Step 2: Add the dev proxy to `web/vite.config.js`**

Replace the file contents with:

```js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 3: Create `web/src/lib/api.js`**

```js
const BASE_URL = '/api';

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패 (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function uploadDeck(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/decks`, { method: 'POST', body: formData });
  return handleResponse(response);
}

export async function fetchDecks() {
  const response = await fetch(`${BASE_URL}/decks`);
  return handleResponse(response);
}

export async function deleteDeck(deckId) {
  const response = await fetch(`${BASE_URL}/decks/${deckId}`, { method: 'DELETE' });
  return handleResponse(response);
}

export async function fetchQuiz(deckId, count = 10) {
  const params = new URLSearchParams({ count: String(count) });
  if (deckId) params.set('deckId', deckId);
  const response = await fetch(`${BASE_URL}/quiz?${params}`);
  return handleResponse(response);
}

export async function checkAnswer(wordId, answer) {
  const response = await fetch(`${BASE_URL}/quiz/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordId, answer }),
  });
  return handleResponse(response);
}
```

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): scaffold Svelte app with API client and dev proxy"
```

(No automated frontend tests in this plan — the spec's testing plan covers frontend behavior via manual E2E verification in Task 13.)

---

## Task 9: Upload view

**Files:**
- Create: `web/src/lib/UploadView.svelte`

**Interfaces:**
- Consumes: `uploadDeck` from `./api.js`.
- Produces: `<UploadView onUploaded={(deck) => void} />` component. Used by Task 12.

- [ ] **Step 1: Create `web/src/lib/UploadView.svelte`**

```svelte
<script>
  import { uploadDeck } from './api.js';

  export let onUploaded = () => {};

  let uploading = false;
  let errorMessage = '';
  let previewWords = [];

  async function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    uploading = true;
    errorMessage = '';
    previewWords = [];

    try {
      const deck = await uploadDeck(file);
      previewWords = deck.words;
      onUploaded(deck);
    } catch (error) {
      errorMessage = error.message;
    } finally {
      uploading = false;
    }
  }
</script>

<div class="upload-view">
  <input
    type="file"
    accept="image/png,image/jpeg"
    on:change={handleFileChange}
    disabled={uploading}
  />

  {#if uploading}
    <p>이미지 분석 중...</p>
  {/if}

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if previewWords.length > 0}
    <ul>
      {#each previewWords as word (word.id)}
        <li>{word.word} — {word.meaning}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .error {
    color: crimson;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/lib/UploadView.svelte
git commit -m "feat(web): add image upload view with extraction preview"
```

---

## Task 10: Deck list view

**Files:**
- Create: `web/src/lib/DeckListView.svelte`

**Interfaces:**
- Consumes: `fetchDecks`, `deleteDeck` from `./api.js`.
- Produces: `<DeckListView onSelectDeck={(deck) => void} />` component with an exported `refresh()` method (bindable via `bind:this`). Used by Task 12.

- [ ] **Step 1: Create `web/src/lib/DeckListView.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { fetchDecks, deleteDeck } from './api.js';

  export let onSelectDeck = () => {};

  let decks = [];
  let errorMessage = '';

  async function loadDecks() {
    try {
      decks = await fetchDecks();
    } catch (error) {
      errorMessage = error.message;
    }
  }

  async function handleDelete(deckId) {
    await deleteDeck(deckId);
    await loadDecks();
  }

  onMount(loadDecks);

  export function refresh() {
    return loadDecks();
  }
</script>

<div class="deck-list">
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if decks.length === 0}
    <p>단어장이 없습니다. 이미지를 업로드해보세요.</p>
  {/if}

  <ul>
    {#each decks as deck (deck.id)}
      <li>
        <button on:click={() => onSelectDeck(deck)}>{deck.name} ({deck.wordCount}개)</button>
        <button on:click={() => handleDelete(deck.id)}>삭제</button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .error {
    color: crimson;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/lib/DeckListView.svelte
git commit -m "feat(web): add deck list view with delete"
```

---

## Task 11: Quiz view

**Files:**
- Create: `web/src/lib/QuizView.svelte`

**Interfaces:**
- Consumes: `fetchQuiz`, `checkAnswer` from `./api.js`.
- Produces: `<QuizView deckId={string} onFinish={({total, correct}) => void} />` component. Used by Task 12.

- [ ] **Step 1: Create `web/src/lib/QuizView.svelte`**

```svelte
<script>
  import { fetchQuiz, checkAnswer } from './api.js';

  export let deckId;
  export let onFinish = () => {};

  let questions = [];
  let currentIndex = 0;
  let currentAnswer = '';
  let feedback = null;
  let correctCount = 0;
  let loading = true;

  async function loadQuiz() {
    loading = true;
    questions = await fetchQuiz(deckId, 10);
    currentIndex = 0;
    correctCount = 0;
    feedback = null;
    loading = false;
  }

  loadQuiz();

  $: currentQuestion = questions[currentIndex];

  async function submitAnswer() {
    const result = await checkAnswer(currentQuestion.wordId, currentAnswer);
    feedback = result;
    if (result.result !== 'wrong') correctCount += 1;
  }

  function nextQuestion() {
    currentAnswer = '';
    feedback = null;
    if (currentIndex + 1 < questions.length) {
      currentIndex += 1;
    } else {
      onFinish({ total: questions.length, correct: correctCount });
    }
  }
</script>

{#if loading}
  <p>문제를 불러오는 중...</p>
{:else if currentQuestion}
  <div class="quiz">
    <p class="meaning">{currentQuestion.meaning}</p>

    {#if !feedback}
      <input type="text" bind:value={currentAnswer} placeholder="영어 스펠링을 입력하세요" />
      <button on:click={submitAnswer}>제출</button>
    {:else}
      <p class="feedback {feedback.result}">
        {feedback.result === 'wrong' ? '오답' : '정답'} — 정답: {feedback.correctSpelling}
      </p>
      <button on:click={nextQuestion}>다음 문제</button>
    {/if}

    <p class="progress">{currentIndex + 1} / {questions.length}</p>
  </div>
{:else}
  <p>이 단어장에는 문제를 낼 단어가 없습니다.</p>
{/if}

<style>
  .feedback.correct,
  .feedback.close {
    color: seagreen;
  }
  .feedback.wrong {
    color: crimson;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/lib/QuizView.svelte
git commit -m "feat(web): add spelling-recall quiz view"
```

---

## Task 12: App wiring

**Files:**
- Modify: `web/src/App.svelte` (full rewrite)

**Interfaces:**
- Consumes: `UploadView`, `DeckListView`, `QuizView` from `./lib/`.

- [ ] **Step 1: Rewrite `web/src/App.svelte`**

```svelte
<script>
  import UploadView from './lib/UploadView.svelte';
  import DeckListView from './lib/DeckListView.svelte';
  import QuizView from './lib/QuizView.svelte';

  let view = 'list';
  let activeDeckId = null;
  let deckListRef;
  let lastScore = null;

  function handleUploaded() {
    deckListRef?.refresh();
    view = 'list';
  }

  function handleSelectDeck(deck) {
    activeDeckId = deck.id;
    view = 'quiz';
  }

  function handleFinish(score) {
    lastScore = score;
    view = 'list';
  }
</script>

<main>
  <h1>영어단어 이미지 퀴즈</h1>

  {#if view === 'list'}
    <UploadView onUploaded={handleUploaded} />
    {#if lastScore}
      <p>지난 결과: {lastScore.correct} / {lastScore.total}</p>
    {/if}
    <DeckListView bind:this={deckListRef} onSelectDeck={handleSelectDeck} />
  {:else if view === 'quiz'}
    <QuizView deckId={activeDeckId} onFinish={handleFinish} />
  {/if}
</main>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/App.svelte
git commit -m "feat(web): wire upload, deck list, and quiz views together"
```

---

## Task 13: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start MongoDB** (if not already running)
- [ ] **Step 2: Start the API server**

```bash
cd server && npm start
```

- [ ] **Step 3: Start the web dev server** (in a second terminal)

```bash
cd web && npm run dev
```

- [ ] **Step 4: Open the app in a browser** at the Vite dev URL (typically `http://localhost:5173`)
- [ ] **Step 5: Upload a real image containing English words** and confirm the extracted word/meaning preview appears
- [ ] **Step 6: Confirm the new deck appears in the deck list** with the correct word count
- [ ] **Step 7: Start a quiz from that deck** and confirm:
  - the Korean meaning is shown (not the English word)
  - typing the exact spelling shows "정답"
  - typing a 1–2 character typo also shows "정답" (close match)
  - typing something unrelated shows "오답" with the correct spelling revealed
  - the score summary appears after the last question
- [ ] **Step 8: Delete the deck** from the list and confirm it disappears and its words are gone (re-check via `GET /api/decks/:id/words` returning an empty list, or by re-visiting the quiz for that deck)
- [ ] **Step 9: Note any issues found** for follow-up (do not fix silently — report back for the next brainstorming/plan iteration)

---

## Self-Review Notes

- Spec coverage: image upload → extraction (Tasks 4–5), storage (Task 3), deck listing/delete (Task 5), quiz question/check (Task 6), spelling-recall UI (Tasks 9–11), error handling for no-words-found and API failures (Task 5), CORS/dev-proxy (Tasks 5 & 8), Node 22 constraint (Task 1 `engines` field) — all covered.
- Deferred by spec itself (explicitly out of MVP scope, not implemented here): wrong-answer review/spaced repetition, multi-user/login, multiple-choice questions.
- Type/signature consistency checked: `getRandomWords` returns `{wordId, meaning}` (Task 3) and is consumed as-is by `GET /api/quiz` (Task 6) and `QuizView.svelte` (Task 11); `gradeAnswer` return values (`'correct' | 'close' | 'wrong'`) match what `QuizView.svelte` branches on.
