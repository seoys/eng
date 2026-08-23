import {
  createChallenge,
  listReceivedChallenges,
  listSentChallenges,
  listBattles,
} from '../models/challenges.js';
import { getBestResult } from '../models/quizResults.js';
import { getAccessibleDeck, shareDeck } from '../models/decks.js';
import { findUserById } from '../models/users.js';

export async function registerChallengeRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const [received, sent, battles] = await Promise.all([
      listReceivedChallenges(request.userId),
      listSentChallenges(request.userId),
      listBattles(request.userId),
    ]);
    return { received, sent, battles };
  });

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { deckId, toUserId } = request.body ?? {};

    if (!deckId || !toUserId) {
      reply.code(400);
      return { error: '단어장과 상대를 선택해주세요' };
    }
    if (toUserId === request.userId) {
      reply.code(400);
      return { error: '자기 자신에게는 도전장을 보낼 수 없어요' };
    }

    const deck = await getAccessibleDeck(deckId, request.userId);
    if (!deck) {
      reply.code(404);
      return { error: '단어장을 찾을 수 없습니다' };
    }

    const toUser = await findUserById(toUserId);
    if (!toUser) {
      reply.code(404);
      return { error: '상대를 찾을 수 없습니다' };
    }

    const best = await getBestResult(request.userId, deckId);
    if (!best) {
      reply.code(400);
      return { error: '먼저 이 단어장 퀴즈를 풀어야 도전장을 보낼 수 있어요' };
    }

    if (deck.isOwner && !deck.shared) {
      await shareDeck(deckId, request.userId);
    }

    const challenge = await createChallenge({
      fromUserId: request.userId,
      toUserId,
      deckId,
      targetScore: best.score,
      targetCorrect: best.correct,
      targetTotal: best.total,
    });
    reply.code(201);
    return challenge;
  });
}
