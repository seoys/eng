import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { connectMongo, closeMongo, getDb } from '../src/db/mongo.js';
import { createDeck, listDecks, deleteDeck } from '../src/models/decks.js';
import {
  insertWords,
  getWordsByDeck,
  getWordById,
  getRandomWords,
} from '../src/models/words.js';

const TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/eng_quiz_test';

let userId;

before(async () => {
  await connectMongo(TEST_URI);
});

beforeEach(async () => {
  const db = getDb();
  await db.collection('decks').deleteMany({});
  await db.collection('words').deleteMany({});
  userId = new ObjectId().toString();
});

after(async () => {
  await closeMongo();
});

test('createDeck and listDecks returns deck with wordCount', async () => {
  const deck = await createDeck('테스트 단어장', userId);
  await insertWords(
    deck.id,
    [
      { word: 'apple', meaning: '사과' },
      { word: 'banana', meaning: '바나나' },
    ],
    userId,
  );

  const decks = await listDecks(userId);
  assert.equal(decks.length, 1);
  assert.equal(decks[0].name, '테스트 단어장');
  assert.equal(decks[0].wordCount, 2);
});

test('listDecks does not return another user\'s decks', async () => {
  await createDeck('내 단어장', userId);
  const otherUserId = new ObjectId().toString();

  const decks = await listDecks(otherUserId);
  assert.equal(decks.length, 0);
});

test('getWordsByDeck returns inserted words', async () => {
  const deck = await createDeck('단어장2', userId);
  await insertWords(deck.id, [{ word: 'cat', meaning: '고양이' }], userId);

  const words = await getWordsByDeck(deck.id, userId);
  assert.equal(words.length, 1);
  assert.equal(words[0].word, 'cat');
});

test('insertWords stores the animation category and defaults to "none" when omitted', async () => {
  const deck = await createDeck('단어장2b', userId);
  const inserted = await insertWords(
    deck.id,
    [
      { word: 'train', meaning: '기차', animation: 'train' },
      { word: 'apple', meaning: '사과' },
    ],
    userId,
  );
  assert.equal(inserted[0].animation, 'train');
  assert.equal(inserted[1].animation, 'none');

  const words = await getWordsByDeck(deck.id, userId);
  const train = words.find((w) => w.word === 'train');
  assert.equal(train.animation, 'train');
});

test('getWordById returns matching word', async () => {
  const deck = await createDeck('단어장3', userId);
  const [inserted] = await insertWords(deck.id, [{ word: 'dog', meaning: '개' }], userId);

  const found = await getWordById(inserted.id, userId);
  assert.equal(found.word, 'dog');
});

test('getWordById returns null for another user\'s word', async () => {
  const deck = await createDeck('단어장3b', userId);
  const [inserted] = await insertWords(deck.id, [{ word: 'dog', meaning: '개' }], userId);

  const found = await getWordById(inserted.id, new ObjectId().toString());
  assert.equal(found, null);
});

test('getRandomWords respects count, deck filter, and hides spelling', async () => {
  const deck = await createDeck('단어장4', userId);
  await insertWords(
    deck.id,
    [
      { word: 'one', meaning: '하나' },
      { word: 'two', meaning: '둘' },
      { word: 'three', meaning: '셋' },
    ],
    userId,
  );

  const sample = await getRandomWords(deck.id, 2, userId);
  assert.equal(sample.length, 2);
  assert.ok(sample[0].meaning);
  assert.equal(sample[0].word, undefined);
});

test('deleteDeck removes deck and its words', async () => {
  const deck = await createDeck('단어장5', userId);
  await insertWords(deck.id, [{ word: 'x', meaning: 'ㅌ' }], userId);

  const deleted = await deleteDeck(deck.id, userId);
  assert.equal(deleted, true);

  const words = await getWordsByDeck(deck.id, userId);
  assert.equal(words.length, 0);
});

test('deleteDeck returns false for another user\'s deck', async () => {
  const deck = await createDeck('단어장5b', userId);

  const deleted = await deleteDeck(deck.id, new ObjectId().toString());
  assert.equal(deleted, false);
});

test('getRandomWords degrades gracefully when count exceeds available words', async () => {
  const deck = await createDeck('단어장6', userId);
  await insertWords(
    deck.id,
    [
      { word: 'small', meaning: '작은' },
      { word: 'large', meaning: '큰' },
    ],
    userId,
  );

  const sample = await getRandomWords(deck.id, 10, userId);
  assert.equal(sample.length, 2);
  assert.ok(sample.every(w => w.meaning && !w.word));
});

test('getWordsByDeck returns empty array for empty deck', async () => {
  const deck = await createDeck('단어장7', userId);

  const words = await getWordsByDeck(deck.id, userId);
  assert.equal(Array.isArray(words), true);
  assert.equal(words.length, 0);
});
