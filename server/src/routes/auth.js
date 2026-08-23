import { findUserByNameAndBirthDate, createUser } from '../models/users.js';
import { hashPassword, verifyPassword, signToken } from '../services/auth.js';

export async function registerAuthRoutes(app, { jwtSecret }) {
  app.post('/', async (request, reply) => {
    const { name, birthDate, password } = request.body ?? {};

    if (!name?.trim() || !birthDate?.trim() || !password) {
      reply.code(400);
      return { error: '이름, 생년월일, 비밀번호를 모두 입력해주세요' };
    }
    if (password.length < 4) {
      reply.code(400);
      return { error: '비밀번호는 4자 이상이어야 해요' };
    }

    const trimmedName = name.trim();
    const trimmedBirthDate = birthDate.trim();

    const existing = await findUserByNameAndBirthDate(trimmedName, trimmedBirthDate);

    if (existing) {
      const valid = await verifyPassword(password, existing.passwordHash);
      if (!valid) {
        reply.code(401);
        return { error: '비밀번호가 일치하지 않습니다' };
      }
      const token = signToken(existing.id, jwtSecret);
      return { token, user: { id: existing.id, name: existing.name } };
    }

    const passwordHash = await hashPassword(password);
    const created = await createUser(trimmedName, trimmedBirthDate, passwordHash);
    const token = signToken(created.id, jwtSecret);
    reply.code(201);
    return { token, user: { id: created.id, name: created.name } };
  });
}
