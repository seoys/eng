import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerDeckRoutes } from './routes/decks.js';
import { registerQuizRoutes } from './routes/quiz.js';

export function buildApp({ visionExtractor } = {}) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.decorate('visionExtractor', visionExtractor);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    let message;
    if (statusCode === 413) {
      message = '이미지 크기가 너무 큽니다 (최대 10MB)';
    } else if (statusCode === 500) {
      message = '서버 오류가 발생했습니다';
    } else {
      message = error.message;
    }
    reply.code(statusCode).send({ error: message });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(registerDeckRoutes, { prefix: '/api/decks' });
  app.register(registerQuizRoutes, { prefix: '/api/quiz' });

  return app;
}
