import { getRandomWords, getWordByIdUnscoped } from '../models/words.js';
import { getAccessibleDeck } from '../models/decks.js';
import { gradeAnswer } from '../services/grading.js';
import { recordQuizResult } from '../models/quizResults.js';
import { recordMistake, clearMistake, getRandomMistakeWords } from '../models/mistakes.js';

export async function registerQuizRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { deckId, count, source } = request.query;
    const requestedCount = Number.parseInt(count, 10);
    // No count (or an invalid one) means "quiz on every word in the deck".
    const parsedCount = requestedCount > 0 ? requestedCount : Number.MAX_SAFE_INTEGER;

    if (source === 'mistakes') {
      return getRandomMistakeWords(request.userId, parsedCount);
    }

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
    if (result === 'wrong') {
      await recordMistake(request.userId, word.id, word.deckId, word.word, word.meaning);
    } else {
      await clearMistake(request.userId, word.id);
    }
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
