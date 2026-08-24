import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { registerDeckRoutes } from './routes/decks.js';
import { registerQuizRoutes } from './routes/quiz.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerRankingRoutes } from './routes/rankings.js';
import { registerChallengeRoutes } from './routes/challenges.js';
import { registerUserRoutes } from './routes/users.js';
import { registerAchievementRoutes } from './routes/achievements.js';
import { registerMistakeRoutes } from './routes/mistakes.js';
import { verifyToken } from './services/auth.js';

const DEV_JWT_SECRET = 'insecure-dev-secret-change-me';

export function buildApp({
  visionExtractor,
  sentenceGenerator,
  jwtSecret = DEV_JWT_SECRET,
  staticDir,
} = {}) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.decorate('visionExtractor', visionExtractor);
  app.decorate('sentenceGenerator', sentenceGenerator);

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
  app.register(registerRankingRoutes, { prefix: '/api/rankings' });
  app.register(registerChallengeRoutes, { prefix: '/api/challenges' });
  app.register(registerUserRoutes, { prefix: '/api/users' });
  app.register(registerAchievementRoutes, { prefix: '/api/achievements' });
  app.register(registerMistakeRoutes, { prefix: '/api/mistakes' });

  if (staticDir) {
    app.register(fastifyStatic, { root: staticDir, index: 'index.html' });

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url.startsWith('/api')) {
        reply.code(404).send({ error: '요청한 API를 찾을 수 없습니다' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  return app;
}
