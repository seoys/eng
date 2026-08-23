import { listMistakes } from '../models/mistakes.js';

export async function registerMistakeRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request) => listMistakes(request.userId));
}
