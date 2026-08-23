import { getResultsForUser } from '../models/quizResults.js';
import { listDecks } from '../models/decks.js';
import { countSentChallenges, listReceivedChallengeTargets } from '../models/challenges.js';
import { evaluateAchievements } from '../services/achievements.js';

export async function registerAchievementRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const [results, decks, challengesSent, receivedChallenges] = await Promise.all([
      getResultsForUser(request.userId),
      listDecks(request.userId),
      countSentChallenges(request.userId),
      listReceivedChallengeTargets(request.userId),
    ]);
    return evaluateAchievements({
      results,
      deckCount: decks.length,
      challengesSent,
      receivedChallenges,
    });
  });
}
