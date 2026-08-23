import { getRandomWords, getWordByIdUnscoped } from '../models/words.js';
import { getAccessibleDeck } from '../models/decks.js';
import { gradeAnswer } from '../services/grading.js';
import { recordQuizResult } from '../models/quizResults.js';

export async function registerQuizRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { deckId, count } = request.query;
    const parsedCount = Math.max(1, Number.parseInt(count, 10) || 10);

    if (deckId) {
      const deck = await getAccessibleDeck(deckId, request.userId);
      if (!deck) {
        reply.code(404);
        return { error: '단어장을 찾을 수 없습니다' };
      }
      return getRandomWords(deckId, parsedCount, deck.ownerId);
    }

    return getRandomWords(undefined, parsedCount, request.userId);
  });

  app.post('/check', { preHandler: app.authenticate }, async (request, reply) => {
    const { wordId, answer } = request.body;
    const word = await getWordByIdUnscoped(wordId);
    if (!word) {
      reply.code(404);
      return { error: '단어를 찾을 수 없습니다' };
    }

    if (word.userId !== request.userId) {
      const deck = await getAccessibleDeck(word.deckId, request.userId);
      if (!deck) {
        reply.code(404);
        return { error: '단어를 찾을 수 없습니다' };
      }
    }

    const result = gradeAnswer(word.word, answer ?? '');
    return { result, correctSpelling: word.word };
  });

  app.post('/results', { preHandler: app.authenticate }, async (request, reply) => {
    const { deckId, correct, total } = request.body ?? {};

    if (!deckId || typeof correct !== 'number' || typeof total !== 'number' || total <= 0) {
      reply.code(400);
      return { error: '잘못된 요청입니다' };
    }

    const deck = await getAccessibleDeck(deckId, request.userId);
    if (!deck) {
      reply.code(404);
      return { error: '단어장을 찾을 수 없습니다' };
    }

    return recordQuizResult(request.userId, deckId, correct, total);
  });
}
