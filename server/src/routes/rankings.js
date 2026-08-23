import { getWeeklyLeaderboard } from '../models/quizResults.js';

export async function registerRankingRoutes(app) {
  app.get('/weekly', { preHandler: app.authenticate }, async () => getWeeklyLeaderboard(10));
}
