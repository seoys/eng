import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('words');
}

export async function insertWords(deckId, words, userId) {
  const docs = words.map(({ word, meaning, animation }) => ({
    deckId: new ObjectId(deckId),
    userId: new ObjectId(userId),
    word,
    meaning,
    animation: animation || 'none',
    createdAt: new Date(),
  }));
  const { insertedIds } = await collection().insertMany(docs);
  return docs.map((doc, index) => ({
    id: insertedIds[index].toString(),
    word: doc.word,
    meaning: doc.meaning,
    animation: doc.animation,
  }));
}

export async function countWordsInDeck(deckId) {
  if (!ObjectId.isValid(deckId)) return 0;
  return collection().countDocuments({ deckId: new ObjectId(deckId) });
}

export async function getWordsByDeck(deckId, userId) {
  const docs = await collection()
    .find({ deckId: new ObjectId(deckId), userId: new ObjectId(userId) })
    .toArray();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    word: doc.word,
    meaning: doc.meaning,
    animation: doc.animation || 'none',
  }));
}

export async function getWordById(id, userId) {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    word: doc.word,
    meaning: doc.meaning,
    deckId: doc.deckId.toString(),
  };
}

export async function getWordByIdUnscoped(id) {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    word: doc.word,
    meaning: doc.meaning,
    deckId: doc.deckId.toString(),
    userId: doc.userId.toString(),
  };
}

export async function getRandomWords(deckId, count, userId) {
  const filter = { userId: new ObjectId(userId) };
  if (deckId) filter.deckId = new ObjectId(deckId);

  // A missing/invalid count means "every matching word"; $sample needs a
  // concrete positive size, so resolve it to the real document count.
  const size =
    Number.isInteger(count) && count > 0 ? count : await collection().countDocuments(filter);
  if (size === 0) return [];

  const docs = await collection()
    .aggregate([{ $match: filter }, { $sample: { size } }])
    .toArray();
  return docs.map((doc) => ({
    wordId: doc._id.toString(),
    meaning: doc.meaning,
    animation: doc.animation || 'none',
  }));
}
