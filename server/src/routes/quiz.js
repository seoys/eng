import { getRandomWords, getWordById } from '../models/words.js';
import { gradeAnswer } from '../services/grading.js';

export async function registerQuizRoutes(app) {
  app.get('/', async (request) => {
    const { deckId, count } = request.query;
    const parsedCount = Number.parseInt(count, 10) || 10;
    return getRandomWords(deckId, parsedCount);
  });

  app.post('/check', async (request, reply) => {
    const { wordId, answer } = request.body;
    const word = await getWordById(wordId);
    if (!word) {
      reply.code(404);
      return { error: '단어를 찾을 수 없습니다' };
    }

    const result = gradeAnswer(word.word, answer ?? '');
    return { result, correctSpelling: word.word };
  });
}
