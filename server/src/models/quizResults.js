import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('quiz_results');
}

export function getWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

export async function recordQuizResult(userId, deckId, correct, total) {
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const doc = {
    userId: new ObjectId(userId),
    deckId: new ObjectId(deckId),
    correct,
    total,
    score,
    createdAt: new Date(),
  };
  await collection().insertOne(doc);
  return { score, correct, total };
}

export async function getResultsForUser(userId) {
  const docs = await collection()
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map((doc) => ({
    deckId: doc.deckId.toString(),
    correct: doc.correct,
    total: doc.total,
    score: doc.score,
    createdAt: doc.createdAt,
  }));
}

export async function getBestResult(userId, deckId) {
  const doc = await collection()
    .find({ userId: new ObjectId(userId), deckId: new ObjectId(deckId) })
    .sort({ score: -1, correct: -1 })
    .limit(1)
    .next();
  if (!doc) return null;
  return { score: doc.score, correct: doc.correct, total: doc.total };
}

// Best result on a deck achieved strictly after `since` — used to judge
// challenges, which must only count attempts made once the challenge exists.
export async function getBestResultSince(userId, deckId, since) {
  const doc = await collection()
    .find({
      userId: new ObjectId(userId),
      deckId: new ObjectId(deckId),
      createdAt: { $gt: since },
    })
    .sort({ score: -1, correct: -1 })
    .limit(1)
    .next();
  if (!doc) return null;
  return { score: doc.score, correct: doc.correct, total: doc.total };
}

export async function getWeeklyLeaderboard(limit = 10) {
  const weekStart = getWeekStart();
  const results = await collection()
    .aggregate([
      { $match: { createdAt: { $gte: weekStart } } },
      // Rank by raw correct-answer count, not percentage — a 19/20 result
      // is a stronger showing than a 1/1, even though 1/1 scores "higher".
      { $sort: { correct: -1, total: -1, createdAt: 1 } },
      {
        $group: {
          _id: '$userId',
          bestCorrect: { $first: '$correct' },
          bestTotal: { $first: '$total' },
          bestScore: { $first: '$score' },
          quizCount: { $sum: 1 },
          achievedAt: { $first: '$createdAt' },
        },
      },
      { $sort: { bestCorrect: -1, bestTotal: -1, achievedAt: 1 } },
      { $limit: limit },
    ])
    .toArray();

  if (results.length === 0) return [];

  const userIds = results.map((r) => r._id);
  const users = await getDb()
    .collection('users')
    .find({ _id: { $in: userIds } })
    .toArray();
  const nameById = new Map(users.map((u) => [u._id.toString(), u.name]));

  return results.map((r) => ({
    userId: r._id.toString(),
    name: nameById.get(r._id.toString()) ?? '알 수 없음',
    bestCorrect: r.bestCorrect,
    bestTotal: r.bestTotal,
    bestScore: r.bestScore,
    quizCount: r.quizCount,
  }));
}
