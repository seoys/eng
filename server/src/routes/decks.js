import {
  createDeck,
  countDecksCreatedToday,
  listDecks,
  listSharedDecks,
  deleteDeck,
  getAccessibleDeck,
  shareDeck,
} from '../models/decks.js';
import { insertWords, getWordsByDeck } from '../models/words.js';
import { seoulDateLabel } from '../services/datetime.js';

// Multiple photos of the same page (or overlapping pages) routinely yield the
// same word twice; keep the first occurrence of each, matched case-insensitively.
function dedupeWords(words) {
  const seen = new Set();
  const unique = [];
  for (const entry of words) {
    const key = entry.word.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

export async function registerDeckRoutes(app) {
  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const files = [];
    for await (const file of request.files()) {
      files.push({ filename: file.filename, buffer: await file.toBuffer(), mimetype: file.mimetype });
    }

    if (files.length === 0) {
      reply.code(400);
      return { error: '이미지 파일이 필요합니다' };
    }

    const extractedWords = [];
    let failureCount = 0;
    for (const file of files) {
      try {
        const base64 = file.buffer.toString('base64');
        const words = await app.visionExtractor(base64, file.mimetype);
        extractedWords.push(...words);
      } catch (error) {
        app.log.error(error);
        failureCount += 1;
      }
    }

    if (failureCount === files.length) {
      reply.code(500);
      return { error: '이미지 분석에 실패했습니다' };
    }

    const uniqueWords = dedupeWords(extractedWords);
    if (uniqueWords.length === 0) {
      reply.code(422);
      return { error: '단어를 찾지 못했습니다' };
    }

    const now = new Date();
    const dateLabel = seoulDateLabel(now);
    const todayCount = await countDecksCreatedToday(request.userId, now);
    const name = `${dateLabel} 단어장 ${todayCount + 1} (${uniqueWords.length}개)`;

    const deck = await createDeck(name, request.userId);
    const words = await insertWords(deck.id, uniqueWords, request.userId);

    return { id: deck.id, name: deck.name, words };
  });

  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const [own, shared] = await Promise.all([
      listDecks(request.userId),
      listSharedDecks(request.userId),
    ]);
    const all = [...own, ...shared].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(request.query.pageSize, 10) || 5));
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;

    return {
      items: all.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
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
