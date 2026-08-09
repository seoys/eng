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

test('getRandomWords degrades gracefully when count exceeds available words', async () => {
  const deck = await createDeck('단어장6');
  await insertWords(deck.id, [
    { word: 'small', meaning: '작은' },
    { word: 'large', meaning: '큰' },
  ]);

  const sample = await getRandomWords(deck.id, 10);
  assert.equal(sample.length, 2);
  assert.ok(sample.every(w => w.meaning && !w.word));
});

test('getWordsByDeck returns empty array for empty deck', async () => {
  const deck = await createDeck('단어장7');

  const words = await getWordsByDeck(deck.id);
  assert.equal(Array.isArray(words), true);
  assert.equal(words.length, 0);
});
