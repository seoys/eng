import { listMistakes, getMistake, saveExampleSentence } from '../models/mistakes.js';

export async function registerMistakeRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request) => listMistakes(request.userId));

  app.get('/:wordId/example', { preHandler: app.authenticate }, async (request, reply) => {
    const mistake = await getMistake(request.userId, request.params.wordId);
    if (!mistake) {
      reply.code(404);
      return { error: '오답노트에서 단어를 찾을 수 없습니다' };
    }

    if (mistake.exampleSentence) {
      return { sentence: mistake.exampleSentence };
    }

    let sentence;
    try {
      sentence = await app.sentenceGenerator(mistake.word, mistake.meaning);
    } catch (error) {
      app.log.error(error);
      reply.code(500);
      return { error: '예문 생성에 실패했습니다' };
    }

    await saveExampleSentence(request.userId, request.params.wordId, sentence);
    return { sentence };
  });
}
