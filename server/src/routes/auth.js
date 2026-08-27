import { findUserByName, createUser } from '../models/users.js';
import { hashPassword, verifyPassword, signToken } from '../services/auth.js';

export async function registerAuthRoutes(app, { jwtSecret }) {
  app.post('/', async (request, reply) => {
    const { name, password } = request.body ?? {};

    if (!name?.trim() || !password) {
      reply.code(400);
      return { error: '이름과 비밀번호를 모두 입력해주세요' };
    }
    if (password.length < 4) {
      reply.code(400);
      return { error: '비밀번호는 4자 이상이어야 해요' };
    }

    const trimmedName = name.trim();
    const existing = await findUserByName(trimmedName);

    if (existing) {
      const valid = await verifyPassword(password, existing.passwordHash);
      if (!valid) {
        reply.code(401);
        return { error: '이미 쓰고 있는 이름이에요. 비밀번호가 맞지 않으면 다른 이름을 써주세요' };
      }
      const token = signToken(existing.id, jwtSecret);
      return { token, user: { id: existing.id, name: existing.name } };
    }

    const passwordHash = await hashPassword(password);
    let created;
    try {
      created = await createUser(trimmedName, passwordHash);
    } catch (error) {
      // A concurrent sign-up won the race for this name (unique index).
      if (error?.code === 11000) {
        reply.code(409);
        return { error: '방금 누군가 이 이름을 먼저 만들었어요. 다른 이름을 써주세요' };
      }
      throw error;
    }
    const token = signToken(created.id, jwtSecret);
    reply.code(201);
    return { token, user: { id: created.id, name: created.name } };
  });
}
