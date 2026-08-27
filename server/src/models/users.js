import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('users');
}

// The name is the account identity now, so it must be unique. A unique index
// makes that a hard guarantee even under concurrent sign-ups.
export async function ensureUserIndexes() {
  await collection().createIndex({ name: 1 }, { unique: true });
}

export async function findUserByName(name) {
  const doc = await collection().findOne({ name });
  if (!doc) return null;
  return { id: doc._id.toString(), name: doc.name, passwordHash: doc.passwordHash };
}

export async function createUser(name, passwordHash) {
  const doc = { name, passwordHash, createdAt: new Date() };
  const { insertedId } = await collection().insertOne(doc);
  return { id: insertedId.toString(), name };
}

export async function findUserById(id) {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return { id: doc._id.toString(), name: doc.name };
}

export async function listOtherUsers(excludeUserId) {
  const docs = await collection()
    .find({ _id: { $ne: new ObjectId(excludeUserId) } })
    .project({ name: 1 })
    .sort({ name: 1 })
    .toArray();
  return docs.map((doc) => ({ id: doc._id.toString(), name: doc.name }));
}
