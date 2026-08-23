import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';
import { deleteMistakesForDeck } from './mistakes.js';

function collection() {
  return getDb().collection('decks');
}

async function attachWordCounts(decks) {
  const wordsCol = getDb().collection('words');
  return Promise.all(
    decks.map(async (deck) => ({
      ...deck,
      wordCount: await wordsCol.countDocuments({ deckId: new ObjectId(deck.id) }),
    })),
  );
}

export async function createDeck(name, userId) {
  const doc = { name, userId: new ObjectId(userId), shared: false, createdAt: new Date() };
  const { insertedId } = await collection().insertOne(doc);
  return { id: insertedId.toString(), name: doc.name, createdAt: doc.createdAt };
}

export async function countDecksCreatedToday(userId, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return collection().countDocuments({
    userId: new ObjectId(userId),
    createdAt: { $gte: start, $lt: end },
  });
}

export async function listDecks(userId) {
  const docs = await collection()
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();

  const decks = docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    shared: doc.shared === true,
    ownerName: null,
    createdAt: doc.createdAt,
  }));
  return attachWordCounts(decks);
}

export async function listSharedDecks(userId) {
  const docs = await collection()
    .find({ shared: true, userId: { $ne: new ObjectId(userId) } })
    .sort({ createdAt: -1 })
    .toArray();
  if (docs.length === 0) return [];

  const ownerIds = [...new Set(docs.map((doc) => doc.userId.toString()))].map(
    (id) => new ObjectId(id),
  );
  const owners = await getDb()
    .collection('users')
    .find({ _id: { $in: ownerIds } })
    .toArray();
  const ownerNameById = new Map(owners.map((user) => [user._id.toString(), user.name]));

  const decks = docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    shared: true,
    ownerName: ownerNameById.get(doc.userId.toString()) ?? '알 수 없음',
    createdAt: doc.createdAt,
  }));
  return attachWordCounts(decks);
}

export async function getDeckById(id, userId) {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
  if (!doc) return null;
  return { id: doc._id.toString(), name: doc.name, shared: doc.shared === true };
}

export async function getAccessibleDeck(id, userId) {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  if (!doc) return null;

  const isOwner = doc.userId.toString() === userId;
  if (!isOwner && doc.shared !== true) return null;

  return {
    id: doc._id.toString(),
    name: doc.name,
    ownerId: doc.userId.toString(),
    shared: doc.shared === true,
    isOwner,
  };
}

export async function shareDeck(id, userId) {
  if (!ObjectId.isValid(id)) return false;
  const { matchedCount } = await collection().updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: { shared: true } },
  );
  return matchedCount > 0;
}

export async function deleteDeck(id, userId) {
  if (!ObjectId.isValid(id)) return false;
  const deckId = new ObjectId(id);
  const filter = { _id: deckId, userId: new ObjectId(userId) };
  const deck = await collection().findOne(filter);
  if (!deck) return false;

  await getDb().collection('words').deleteMany({ deckId });
  await deleteMistakesForDeck(id);
  const { deletedCount } = await collection().deleteOne(filter);
  return deletedCount > 0;
}
