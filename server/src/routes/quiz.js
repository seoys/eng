import { ObjectId } from 'mongodb';
import { getRandomWords, getWordById } from '../models/words.js';
import { gradeAnswer } from '../services/grading.js';

export async function registerQuizRoutes(app) {
  app.get('/', async (request) => {
    const { deckId, count } = request.query;
    const parsedCount = Math.max(1, Number.parseInt(count, 10) || 10);
    return getRandomWords(deckId, parsedCount);
  });

  app.post('/check', async (request, reply) => {
    const { wordId, answer } = request.body;
    const word = ObjectId.isValid(wordId) ? await getWordById(wordId) : null;
    if (!word) {
      reply.code(404);
      return { error: '단어를 찾을 수 없습니다' };
    }

    const result = gradeAnswer(word.word, answer ?? '');
    return { result, correctSpelling: word.word };
  });
}
