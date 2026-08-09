import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

function collection() {
  return getDb().collection('decks');
}

export async function createDeck(name) {
  const doc = { name, createdAt: new Date() };
  const { insertedId } = await collection().insertOne(doc);
  return { id: insertedId.toString(), ...doc };
}

export async function listDecks() {
  const wordsCol = getDb().collection('words');
  const decks = await collection().find().sort({ createdAt: -1 }).toArray();

  return Promise.all(
    decks.map(async (deck) => {
      const wordCount = await wordsCol.countDocuments({ deckId: deck._id });
      return {
        id: deck._id.toString(),
        name: deck.name,
        wordCount,
        createdAt: deck.createdAt,
      };
    }),
  );
}

export async function deleteDeck(id) {
  const deckId = new ObjectId(id);
  await getDb().collection('words').deleteMany({ deckId });
  const { deletedCount } = await collection().deleteOne({ _id: deckId });
  return deletedCount > 0;
}
