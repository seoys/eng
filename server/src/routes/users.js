import { listOtherUsers } from '../models/users.js';

export async function registerUserRoutes(app) {
  app.get('/', { preHandler: app.authenticate }, async (request) =>
    listOtherUsers(request.userId),
  );
}
