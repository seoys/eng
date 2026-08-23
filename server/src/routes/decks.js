import {
  createDeck,
  listDecks,
  listSharedDecks,
  deleteDeck,
  getAccessibleDeck,
  shareDeck,
} from '../models/decks.js';
import { insertWords, getWordsByDeck } from '../models/words.js';

export async function registerDeckRoutes(app) {
  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: '이미지 파일이 필요합니다' };
    }

    const buffer = await file.toBuffer();
    const base64 = buffer.toString('base64');
    const mediaType = file.mimetype;

    let extractedWords;
    try {
      extractedWords = await app.visionExtractor(base64, mediaType);
    } catch (error) {
      app.log.error(error);
      reply.code(500);
      return { error: '이미지 분석에 실패했습니다' };
    }

    if (extractedWords.length === 0) {
      reply.code(422);
      return { error: '단어를 찾지 못했습니다' };
    }

    const name = file.filename
      ? file.filename.replace(/\.[^.]+$/, '')
      : `${new Date().toISOString().slice(0, 10)} 단어장`;

    const deck = await createDeck(name, request.userId);
    const words = await insertWords(deck.id, extractedWords, request.userId);

    return { id: deck.id, name: deck.name, words };
  });

  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const [own, shared] = await Promise.all([
      listDecks(request.userId),
      listSharedDecks(request.userId),
    ]);
    return [...own, ...shared];
  });

  app.post('/:id/share', { preHandler: app.authenticate }, async (request, reply) => {
    const shared = await shareDeck(request.params.id, request.userId);
    if (!shared) {
      reply.code(404);
      return { error: '단어장을 찾을 수 없습니다' };
    }
    return { shared: true };
  });

  app.get('/:id/words', { preHandler: app.authenticate }, async (request, reply) => {
    const deck = await getAccessibleDeck(request.params.id, request.userId);
    if (!deck) {
      reply.code(404);
      return { error: '단어장을 찾을 수 없습니다' };
    }
    return getWordsByDeck(request.params.id, deck.ownerId);
  });

  app.delete('/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const deleted = await deleteDeck(request.params.id, request.userId);
    if (!deleted) {
      reply.code(404);
      return { error: '단어장을 찾을 수 없습니다' };
    }
    reply.code(204);
    return null;
  });
}
