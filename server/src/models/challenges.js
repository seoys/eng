import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('challenges');
}

export async function createChallenge({
  fromUserId,
  toUserId,
  deckId,
  targetScore,
  targetCorrect,
  targetTotal,
}) {
  const doc = {
    fromUserId: new ObjectId(fromUserId),
    toUserId: new ObjectId(toUserId),
    deckId: new ObjectId(deckId),
    targetScore,
    targetCorrect,
    targetTotal,
    createdAt: new Date(),
  };
  const { insertedId } = await collection().insertOne(doc);
  return hydrateOne({ _id: insertedId, ...doc });
}

export async function countSentChallenges(userId) {
  return collection().countDocuments({ fromUserId: new ObjectId(userId) });
}

export async function listReceivedChallengeTargets(userId) {
  const docs = await collection()
    .find({ toUserId: new ObjectId(userId) })
    .project({ deckId: 1, targetScore: 1, createdAt: 1 })
    .toArray();
  return docs.map((doc) => ({
    deckId: doc.deckId.toString(),
    targetScore: doc.targetScore,
    createdAt: doc.createdAt,
  }));
}

export async function listReceivedChallenges(userId) {
  const docs = await collection()
    .find({ toUserId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return hydrate(docs);
}

export async function listSentChallenges(userId) {
  const docs = await collection()
    .find({ fromUserId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return hydrate(docs);
}

async function hydrateOne(doc) {
  const [result] = await hydrate([doc]);
  return result;
}

async function hydrate(docs) {
  if (docs.length === 0) return [];
  const db = getDb();

  const userIds = [
    ...new Set(docs.flatMap((d) => [d.fromUserId.toString(), d.toUserId.toString()])),
  ].map((id) => new ObjectId(id));
  const deckIds = [...new Set(docs.map((d) => d.deckId.toString()))].map((id) => new ObjectId(id));

  const [users, decks] = await Promise.all([
    db.collection('users').find({ _id: { $in: userIds } }).toArray(),
    db.collection('decks').find({ _id: { $in: deckIds } }).toArray(),
  ]);
  const nameById = new Map(users.map((u) => [u._id.toString(), u.name]));
  const deckById = new Map(decks.map((d) => [d._id.toString(), d.name]));

  return docs.map((d) => ({
    id: d._id.toString(),
    fromUserId: d.fromUserId.toString(),
    fromName: nameById.get(d.fromUserId.toString()) ?? '알 수 없음',
    toUserId: d.toUserId.toString(),
    toName: nameById.get(d.toUserId.toString()) ?? '알 수 없음',
    deckId: d.deckId.toString(),
    deckName: deckById.get(d.deckId.toString()) ?? '(삭제된 단어장)',
    targetScore: d.targetScore,
    targetCorrect: d.targetCorrect,
    targetTotal: d.targetTotal,
    createdAt: d.createdAt,
  }));
}
