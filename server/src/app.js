import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerDeckRoutes } from './routes/decks.js';
import { registerQuizRoutes } from './routes/quiz.js';
import { registerAuthRoutes } from './routes/auth.js';
import { verifyToken } from './services/auth.js';

const DEV_JWT_SECRET = 'insecure-dev-secret-change-me';

export function buildApp({ visionExtractor, jwtSecret = DEV_JWT_SECRET } = {}) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.decorate('visionExtractor', visionExtractor);

  app.decorate('authenticate', async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      reply.code(401).send({ error: '로그인이 필요합니다' });
      return;
    }
    try {
      request.userId = verifyToken(token, jwtSecret);
    } catch {
      reply.code(401).send({ error: '로그인이 만료되었습니다. 다시 로그인해주세요' });
    }
  });

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

  app.register(registerAuthRoutes, { prefix: '/api/auth', jwtSecret });
  app.register(registerDeckRoutes, { prefix: '/api/decks' });
  app.register(registerQuizRoutes, { prefix: '/api/quiz' });

  return app;
}
