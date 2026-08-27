import { getRandomWords, getWordByIdUnscoped, countWordsInDeck } from '../models/words.js';
import { getAccessibleDeck } from '../models/decks.js';
import { gradeAnswer } from '../services/grading.js';
import { recordQuizResult } from '../models/quizResults.js';
import { recordMistake, clearMistake, getRandomMistakeWords } from '../models/mistakes.js';

export async function registerQuizRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { deckId, count, source } = request.query;
    const requestedCount = Number.parseInt(count, 10);
    // No count (or an invalid one) means "quiz on every word" — the model
    // resolves that to the actual matching document count.
    const parsedCount = requestedCount > 0 ? requestedCount : null;

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

    if (
      !deckId ||
      !Number.isInteger(correct) ||
      !Number.isInteger(total) ||
      total <= 0 ||
      correct < 0 ||
      correct > total
    ) {
      reply.code(400);
      return { error: '잘못된 요청입니다' };
    }

    const deck = await getAccessibleDeck(deckId, request.userId);
    if (!deck) {
      reply.code(404);
      return { error: '단어장을 찾을 수 없습니다' };
    }

    // The client reports its own score; a quiz can never have more questions
    // than the deck has words, so reject anything that claims otherwise.
    const wordCount = await countWordsInDeck(deckId);
    if (total > wordCount) {
      reply.code(400);
      return { error: '잘못된 요청입니다' };
    }

    return recordQuizResult(request.userId, deckId, correct, total);
  });
}
