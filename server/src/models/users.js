import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('users');
}

export async function findUserByNameAndBirthDate(name, birthDate) {
  const doc = await collection().findOne({ name, birthDate });
  if (!doc) return null;
  return { id: doc._id.toString(), name: doc.name, birthDate: doc.birthDate, passwordHash: doc.passwordHash };
}

export async function createUser(name, birthDate, passwordHash) {
  const doc = { name, birthDate, passwordHash, createdAt: new Date() };
  const { insertedId } = await collection().insertOne(doc);
  return { id: insertedId.toString(), name, birthDate };
}

export async function findUserById(id) {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return { id: doc._id.toString(), name: doc.name, birthDate: doc.birthDate };
}

export async function listOtherUsers(excludeUserId) {
  const docs = await collection()
    .find({ _id: { $ne: new ObjectId(excludeUserId) } })
    .project({ name: 1 })
    .sort({ name: 1 })
    .toArray();
  return docs.map((doc) => ({ id: doc._id.toString(), name: doc.name }));
}
