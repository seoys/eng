import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('mistakes');
}

export async function recordMistake(userId, wordId, deckId, word, meaning) {
  await collection().updateOne(
    { userId: new ObjectId(userId), wordId: new ObjectId(wordId) },
    {
      $set: { deckId: new ObjectId(deckId), word, meaning },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

export async function clearMistake(userId, wordId) {
  await collection().deleteOne({ userId: new ObjectId(userId), wordId: new ObjectId(wordId) });
}

export async function deleteMistakesForDeck(deckId) {
  await collection().deleteMany({ deckId: new ObjectId(deckId) });
}

export async function listMistakes(userId) {
  const docs = await collection()
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) => ({
    wordId: doc.wordId.toString(),
    word: doc.word,
    meaning: doc.meaning,
    createdAt: doc.createdAt,
  }));
}

export async function getMistake(userId, wordId) {
  const doc = await collection().findOne({
    userId: new ObjectId(userId),
    wordId: new ObjectId(wordId),
  });
  if (!doc) return null;
  return {
    wordId: doc.wordId.toString(),
    word: doc.word,
    meaning: doc.meaning,
    exampleSentence: doc.exampleSentence ?? null,
  };
}

export async function saveExampleSentence(userId, wordId, exampleSentence) {
  await collection().updateOne(
    { userId: new ObjectId(userId), wordId: new ObjectId(wordId) },
    { $set: { exampleSentence } },
  );
}

export async function getRandomMistakeWords(userId, count) {
  const docs = await collection()
    .aggregate([{ $match: { userId: new ObjectId(userId) } }, { $sample: { size: count } }])
    .toArray();
  return docs.map((doc) => ({ wordId: doc.wordId.toString(), meaning: doc.meaning }));
}
