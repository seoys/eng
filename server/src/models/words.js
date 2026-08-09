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
