import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerDeckRoutes } from './routes/decks.js';

export function buildApp({ visionExtractor } = {}) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart);

  app.decorate('visionExtractor', visionExtractor);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    reply
      .code(statusCode)
      .send({ error: statusCode === 500 ? '서버 오류가 발생했습니다' : error.message });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(registerDeckRoutes, { prefix: '/api/decks' });

  return app;
}
